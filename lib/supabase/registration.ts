import type { SupabaseClient } from "@supabase/supabase-js";

type RegistrationEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

type AdminClientFactory = (url: string, secretKey: string, publicKey?: string) => SupabaseClient;

const registrationRecoveryBanDuration = "876000h";

const unavailable = () => Response.json(
  { error: "Registration is temporarily unavailable. Please try again later." },
  { status: 503 },
);

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? error.code : "unknown";
}

async function logRegistrationRecoveryFailure(
  client: SupabaseClient,
  authUserId: string,
  event: string,
  error: unknown,
) {
  let authIdentityBanned = false;
  let banErrorCode: unknown;
  try {
    const result = await client.auth.admin.updateUserById(authUserId, {
      ban_duration: registrationRecoveryBanDuration,
    });
    if (result.error) throw result.error;
    authIdentityBanned = true;
  } catch (banError) {
    banErrorCode = getErrorCode(banError);
  }

  console.error(event, {
    authUserId,
    errorCode: getErrorCode(error),
    authIdentityBanned,
    ...(authIdentityBanned ? {} : { banErrorCode }),
  });
}

export async function handleRegistrationRequest(
  request: Request,
  environment: RegistrationEnvironment,
  createAdminClient: AdminClientFactory,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    const status = error instanceof SyntaxError || error instanceof TypeError ? 400 : 500;
    return Response.json(
      { error: status === 400 ? "Enter a valid registration request." : "Registration failed. Please try again." },
      { status },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Enter your first name, last name, and email." }, { status: 400 });
  }

  const fields = body as Record<string, unknown>;
  const allowedFields = ["firstName", "lastName", "email"];
  const firstName = typeof fields.firstName === "string" ? fields.firstName.trim() : "";
  const lastName = typeof fields.lastName === "string" ? fields.lastName.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";

  if (
    Object.keys(fields).some((field) => !allowedFields.includes(field)) ||
    !firstName || Array.from(firstName).length > 100 ||
    !lastName || Array.from(lastName).length > 100 ||
    Array.from(email).length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return Response.json(
      { error: "Enter your first name, last name, and a valid email." },
      { status: 400 },
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey, SUPABASE_SECRET_KEY: secretKey } = environment;
  if (!url || !secretKey || secretKey === publicKey || secretKey.startsWith("sb_publishable_")) return unavailable();

  let client: SupabaseClient;
  try {
    client = createAdminClient(url, secretKey, publicKey);
  } catch {
    return unavailable();
  }

  let roleId: string;
  try {
    const role = await client.rpc("default_user_role_id");
    if (role.error || role.data === null || role.data === undefined) return unavailable();
    roleId = String(role.data);
    if (!/^\d+$/.test(roleId)) return unavailable();
  } catch {
    return unavailable();
  }

  let authUserId: string;
  try {
    const { data, error } = await client.auth.admin.createUser({
      email,
      email_confirm: false,
      app_metadata: { hope_first_password_complete: false },
    });
    if (error || !data.user?.id) {
      if (error?.status === 429) {
        return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
      }
      if (error?.code === "email_exists" || error?.code === "user_already_exists") {
        return Response.json({ error: "Registration could not be completed for these details." }, { status: 409 });
      }
      return unavailable();
    }
    authUserId = data.user.id;
  } catch {
    return unavailable();
  }

  let profile: { auth_user_id: string; role_id: number | string; account_state: string; is_blocked: boolean; is_deleted: boolean } | null;
  let profileError: { code?: string } | null;
  try {
    const result = await client.from("app_user")
      .insert({ auth_user_id: authUserId, first_name: firstName, last_name: lastName, email })
      .select("auth_user_id, role_id, account_state, is_blocked, is_deleted")
      .single();
    profile = result.data;
    profileError = result.error;
  } catch {
    profile = null;
    profileError = { code: "unexpected" };
  }

  if (profileError || !profile) {
    try {
      const cleanup = await client.auth.admin.deleteUser(authUserId);
      if (cleanup.error) throw cleanup.error;
    } catch (error) {
      await logRegistrationRecoveryFailure(client, authUserId, "Registration rollback failed", error);
      return Response.json({ error: "Registration could not be completed. Please contact an administrator." }, { status: 500 });
    }
    if (profileError?.code === "23505") {
      return Response.json({ error: "Registration could not be completed for these details." }, { status: 409 });
    }
    return unavailable();
  }

  if (
    profile.auth_user_id !== authUserId || String(profile.role_id) !== roleId ||
    profile.account_state !== "pending" || profile.is_blocked !== false || profile.is_deleted !== false
  ) {
    try {
      const rollback = await client.from("app_user")
        .update({ is_blocked: true, is_deleted: true })
        .eq("auth_user_id", authUserId)
        .select("auth_user_id")
        .single();
      if (rollback.error || rollback.data?.auth_user_id !== authUserId) {
        throw rollback.error ?? new Error("Registration quarantine did not update the profile.");
      }
    } catch (error) {
      await logRegistrationRecoveryFailure(client, authUserId, "Registration profile quarantine failed", error);
    }
    return Response.json({ error: "Registration could not be completed. Please contact an administrator." }, { status: 500 });
  }

  return Response.json({ status: "pending" }, { status: 201 });
}
