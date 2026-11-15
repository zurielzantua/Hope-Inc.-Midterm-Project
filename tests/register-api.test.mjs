import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const registrationPath = new URL("../lib/supabase/registration.ts", import.meta.url);
const registrationSource = await readFile(registrationPath, "utf8");
const { outputText } = ts.transpileModule(registrationSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { handleRegistrationRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const configuration = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "test-only-placeholder-not-a-real-key",
};

function mockAdmin(options = {}) {
  const calls = [];
  const client = {
    rpc: async (name) => {
      calls.push(["rpc", name]);
      return options.roleResult ?? { data: 7, error: null };
    },
    auth: { admin: {
      createUser: async (attributes) => {
        calls.push(["createUser", attributes]);
        if (options.authThrows) throw new Error("private auth details");
        return options.authResult ?? { data: { user: { id: "auth-user-123" } }, error: null };
      },
      deleteUser: async (id) => {
        calls.push(["deleteUser", id]);
        return options.cleanupResult ?? { error: null };
      },
      updateUserById: async (id, attributes) => {
        calls.push(["updateUserById", id, attributes]);
        return options.banResult ?? { data: { user: { id } }, error: null };
      },
    } },
    from: (table) => ({
      insert: (row) => {
        calls.push(["insert", table, row]);
        if (options.profileThrows) throw new Error("private database details");
        return { select: (columns) => ({
          single: async () => {
            calls.push(["select", columns]);
            return options.profileResult ?? { data: {
              auth_user_id: "auth-user-123", role_id: 7,
              account_state: "pending", is_blocked: false, is_deleted: false,
            }, error: null };
          },
        }) };
      },
      update: (values) => ({
        eq: (column, value) => {
          calls.push(["update", table, values, column, value]);
          return { select: (columns) => ({
            single: async () => {
              calls.push(["selectUpdate", columns]);
              return options.tombstoneResult ?? { data: { auth_user_id: value }, error: null };
            },
          }) };
        },
      }),
    }),
  };
  return { client, calls };
}

const unseeded = mockAdmin({ roleResult: { data: null, error: { code: "P0001" } } });
async function POST(request, options = {}) {
  return handleRegistrationRequest(
    request,
    options.configuration ?? configuration,
    options.createAdminClient ?? (() => unseeded.client),
  );
}

function jsonRequest(body) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("valid user details remain unavailable when the DBA-05 User role is not seeded", async () => {
  const response = await POST(jsonRequest({
    firstName: "Alex",
    lastName: "Rivera",
    email: "alex@example.test",
  }));

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /unavailable/i);
  assert.deepEqual(unseeded.calls, [["rpc", "default_user_role_id"]]);
});

test("missing, blank, invalid, or incorrectly typed fields are rejected", async () => {
  const invalidBodies = [
    { lastName: "Rivera", email: "alex@example.test" },
    { firstName: "Alex", email: "alex@example.test" },
    { firstName: "Alex", lastName: "Rivera" },
    { firstName: "  ", lastName: "Rivera", email: "alex@example.test" },
    { firstName: "Alex", lastName: "   ", email: "alex@example.test" },
    { firstName: "Alex", lastName: "Rivera", email: "bad-email" },
    { firstName: 4, lastName: "Rivera", email: "alex@example.test" },
    { firstName: "Alex", lastName: null, email: "alex@example.test" },
    null,
    [],
  ];

  for (const body of invalidBodies) {
    const response = await POST(jsonRequest(body));
    assert.equal(response.status, 400);
  }
});

test("name and email limits match the DBA-03 column sizes", async () => {
  const valid = { firstName: "Alex", lastName: "Rivera", email: "alex@example.test" };
  for (const [field, value] of [
    ["firstName", "a".repeat(101)],
    ["lastName", "b".repeat(101)],
    ["email", `${"a".repeat(309)}@example.test`],
  ]) {
    assert.equal((await POST(jsonRequest({ ...valid, [field]: value }))).status, 400, `accepted oversized ${field}`);
  }
});

test("surrounding whitespace is trimmed before validation", async () => {
  const response = await POST(jsonRequest({
    firstName: "  Alex ",
    lastName: " Rivera  ",
    email: "  alex@example.test  ",
  }));
  assert.equal(response.status, 503);
});

test("unknown and privileged account fields are rejected", async () => {
  for (const field of ["role", "role_id", "status", "account_state", "isBlocked", "is_blocked", "isApproved", "is_approved", "permissions", "superAdmin"]) {
    const response = await POST(jsonRequest({
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@example.test",
      [field]: field === "permissions" ? ["all"] : "superadmin",
    }));
    assert.equal(response.status, 400, `accepted unexpected field ${field}`);
  }
});

test("malformed JSON returns a client error", async () => {
  const response = await POST(new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));

  assert.equal(response.status, 400);
});

test("unexpected request parsing errors return a generic server error", async () => {
  const requestWithServerError = new Request("http://localhost/api/register", { method: "POST" });
  requestWithServerError.json = async () => { throw new Error("sensitive internal detail"); };

  const response = await POST(requestWithServerError);
  assert.equal(response.status, 500);
  assert.doesNotMatch((await response.text()), /sensitive internal detail/);
});

test("missing secret configuration fails before creating an Auth client", async () => {
  let clientCreated = false;
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), {
    configuration: { NEXT_PUBLIC_SUPABASE_URL: configuration.NEXT_PUBLIC_SUPABASE_URL },
    createAdminClient: () => { clientCreated = true; throw new Error("must not run"); },
  });
  assert.equal(response.status, 503);
  assert.equal(clientCreated, false);
});

test("missing seeded User role fails before creating an Auth identity", async () => {
  const admin = mockAdmin({ roleResult: { data: null, error: { code: "P0001" } } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 503);
  assert.deepEqual(admin.calls, [["rpc", "default_user_role_id"]]);
});

test("success creates an unconfirmed email-only identity and links its Pending User profile", async () => {
  const admin = mockAdmin();
  const response = await POST(jsonRequest({
    firstName: " Alex ", lastName: " Rivera ", email: " alex@example.test ",
  }), { createAdminClient: () => admin.client });

  assert.equal(response.status, 201);
  const responseBody = await response.json();
  assert.equal(responseBody.status, "pending");
  const authCreation = admin.calls.find(([name]) => name === "createUser");
  assert.deepEqual(authCreation, ["createUser", {
    email: "alex@example.test",
    email_confirm: false,
    app_metadata: { hope_first_password_complete: false },
  }]);
  assert.deepEqual(admin.calls.find(([name]) => name === "insert"), ["insert", "app_user", {
    auth_user_id: "auth-user-123", first_name: "Alex", last_name: "Rivera", email: "alex@example.test",
  }]);
  assert.equal("password" in authCreation[1], false);
  assert.equal("user_metadata" in authCreation[1], false);
  assert.equal("session" in responseBody, false);
});

test("email is lowercased before Auth and profile persistence", async () => {
  const admin = mockAdmin();
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: " Alex@Example.Test ",
  }), { createAdminClient: () => admin.client });

  assert.equal(response.status, 201);
  assert.deepEqual(admin.calls.find(([name]) => name === "createUser"), [
    "createUser", {
      email: "alex@example.test",
      email_confirm: false,
      app_metadata: { hope_first_password_complete: false },
    },
  ]);
  assert.deepEqual(admin.calls.find(([name]) => name === "insert"), ["insert", "app_user", {
    auth_user_id: "auth-user-123", first_name: "Alex", last_name: "Rivera", email: "alex@example.test",
  }]);
});

test("registration accepts Yahoo and institutional email domains", async () => {
  for (const email of ["person@yahoo.com", "student@university.edu", "student@dept.university.edu.ph"]) {
    const admin = mockAdmin();
    const response = await POST(jsonRequest({ firstName: "Alex", lastName: "Rivera", email }), {
      createAdminClient: () => admin.client,
    });
    assert.equal(response.status, 201, email);
    assert.equal(admin.calls.find(([name]) => name === "createUser")[1].email, email);
  }
});

test("duplicate email response does not expose Auth provider details", async () => {
  const admin = mockAdmin({ authResult: { data: { user: null }, error: { code: "email_exists", message: "email exists" } } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 409);
  assert.doesNotMatch(await response.text(), /email exists|alex@example\.test/);
  assert.equal(admin.calls.some(([name]) => name === "insert"), false);
});

test("duplicate application profile returns a generic conflict after Auth cleanup", async () => {
  const admin = mockAdmin({ profileResult: { data: null, error: { code: "23505", message: "duplicate key" } } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });

  assert.equal(response.status, 409);
  assert.doesNotMatch(await response.text(), /23505|duplicate key|alex@example\.test/);
  assert.ok(admin.calls.some(([name, id]) => name === "deleteUser" && id === "auth-user-123"));
});

test("Auth creation failure is generic and creates no profile", async () => {
  const admin = mockAdmin({ authThrows: true });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private auth details|alex@example\.test/);
  assert.equal(admin.calls.some(([name]) => name === "insert"), false);
});

test("email invitation is not sent as part of public registration", async () => {
  const admin = mockAdmin();
  await POST(jsonRequest({ firstName: "Alex", lastName: "Rivera", email: "alex@example.test" }), {
    createAdminClient: () => admin.client,
  });
  assert.equal(admin.calls.some(([name]) => name === "inviteUserByEmail"), false);
});

test("profile insertion failure cleans up the newly created Auth identity", async () => {
  const admin = mockAdmin({ profileResult: { data: null, error: { code: "42501" } } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 503);
  assert.ok(admin.calls.some(([name, id]) => name === "deleteUser" && id === "auth-user-123"));
  assert.doesNotMatch(await response.text(), /23505|alex@example\.test/);
});

test("unexpected profile insertion errors clean up Auth and return a generic response", async () => {
  const admin = mockAdmin({ profileThrows: true });
  const response = await POST(jsonRequest({ firstName: "Alex", lastName: "Rivera", email: "alex@example.test" }), {
    createAdminClient: () => admin.client,
  });
  assert.equal(response.status, 503);
  assert.ok(admin.calls.some(([name, id]) => name === "deleteUser" && id === "auth-user-123"));
  assert.doesNotMatch(await response.text(), /private database details/);
});

test("profile failure and Auth cleanup failure bans the identity and logs safe diagnostics", async () => {
  const admin = mockAdmin({
    profileResult: { data: null, error: { code: "23505" } },
    cleanupResult: { error: { code: "cleanup_failed", message: "private cleanup detail" } },
  });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const response = await POST(jsonRequest({
      firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
    }), { createAdminClient: () => admin.client });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /private cleanup detail|auth-user-123/);
  } finally {
    console.error = originalError;
  }
  assert.equal(JSON.stringify(logged).includes("alex@example.test"), false);
  assert.equal(JSON.stringify(logged).includes("private cleanup detail"), false);
  assert.ok(JSON.stringify(logged).includes("auth-user-123"));
  assert.ok(JSON.stringify(logged).includes("cleanup_failed"));
  assert.deepEqual(admin.calls.find(([name]) => name === "updateUserById"), [
    "updateUserById", "auth-user-123", { ban_duration: "876000h" },
  ]);
});

test("wrong database defaults are soft-deleted and never reported successful", async () => {
  const admin = mockAdmin({ profileResult: { data: {
    auth_user_id: "auth-user-123", role_id: 9,
    account_state: "approved", is_blocked: false, is_deleted: false,
  }, error: null } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 500);
  assert.deepEqual(admin.calls.find(([name]) => name === "update"), [
    "update", "app_user", { is_blocked: true, is_deleted: true }, "auth_user_id", "auth-user-123",
  ]);
  assert.ok(admin.calls.some(([name, columns]) => name === "selectUpdate" && columns === "auth_user_id"));
  assert.equal(admin.calls.some(([name]) => name === "deleteUser"), false);
});

test("quarantine response verifies the profile was actually blocked and soft-deleted", async () => {
  const admin = mockAdmin({
    profileResult: { data: {
      auth_user_id: "auth-user-123", role_id: 9,
      account_state: "approved", is_blocked: false, is_deleted: false,
    }, error: null },
    tombstoneResult: { data: null, error: null },
  });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const response = await POST(jsonRequest({
      firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
    }), { createAdminClient: () => admin.client });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /auth-user-123/);
  } finally {
    console.error = originalError;
  }
  assert.ok(JSON.stringify(logged).includes("Registration profile quarantine failed"));
  assert.ok(JSON.stringify(logged).includes("auth-user-123"));
  assert.deepEqual(admin.calls.find(([name]) => name === "updateUserById"), [
    "updateUserById", "auth-user-123", { ban_duration: "876000h" },
  ]);
});

test("failure to ban an identity after quarantine failure is logged without exposing details", async () => {
  const admin = mockAdmin({
    profileResult: { data: {
      auth_user_id: "auth-user-123", role_id: 9,
      account_state: "approved", is_blocked: false, is_deleted: false,
    }, error: null },
    tombstoneResult: { data: null, error: { code: "quarantine_failed", message: "private database detail" } },
    banResult: { data: { user: null }, error: { code: "ban_failed", message: "private auth detail" } },
  });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const response = await POST(jsonRequest({
      firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
    }), { createAdminClient: () => admin.client });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /private database detail|private auth detail|auth-user-123/);
  } finally {
    console.error = originalError;
  }
  assert.ok(JSON.stringify(logged).includes("quarantine_failed"));
  assert.ok(JSON.stringify(logged).includes("ban_failed"));
  assert.ok(JSON.stringify(logged).includes("auth-user-123"));
  assert.equal(JSON.stringify(logged).includes("private auth detail"), false);
});

test("Auth rate limits are returned as a generic 429", async () => {
  const admin = mockAdmin({ authResult: { data: { user: null }, error: { code: "over_email_send_rate_limit", status: 429 } } });
  const response = await POST(jsonRequest({
    firstName: "Alex", lastName: "Rivera", email: "alex@example.test",
  }), { createAdminClient: () => admin.client });
  assert.equal(response.status, 429);
  assert.doesNotMatch(await response.text(), /over_email_send_rate_limit|alex@example\.test/);
});
