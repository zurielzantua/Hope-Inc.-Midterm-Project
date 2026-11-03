# HOPE Inc. ERP — Registration UI Handoff

Related GitHub issues: [S1-UIX-01 #1](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/1), [S1-DEV-02 #21](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/21).

## Screen and design system

The registration panel remains inside the existing authentication card in `app/page.tsx`. The surrounding landing page and Login/Reset Password panels are unchanged.

| Token | Value | Use |
|---|---|---|
| Deep Harbor | `#163341` | Page background |
| Harbor Teal | `#0B6E75` | Primary action and focus |
| Brushed Bronze | `#C28C58` | Sign In link and restrained accents |
| Cloud | `#F4F7F8` | Light surface token |
| White | `#FFFFFF` | Main text |
| Ink | `#1A2B35` | Text on light surfaces |

Typography follows the existing theme: Aptos/Segoe UI for interface text and Georgia for display headings. Labels stay above their fields. First and last name share a row on wider screens and stack on mobile; email and the Register button span the panel width.

The form explains that new accounts start as User and need admin approval. It does not offer role selection.

### Layout reference

Desktop:

```text
┌────────────────────────────┐
│ Existing landing content   │  Secure access
│ remains unchanged          │  Login | Register | Reset
│                            │  Create your account
│                            │  [First Name] [Last Name]
│                            │  [Email Address          ]
│                            │  [Register               ]
│                            │  Already have an account? Sign In
└────────────────────────────┘
```

Mobile:

```text
┌────────────────────────────┐
│ Existing landing content   │
├────────────────────────────┤
│ Secure access               │
│ Login | Register | Reset    │
│ Create your account         │
│ [First Name               ] │
│ [Last Name                ] │
│ [Email Address            ] │
│ [Register                 ] │
│ Already have an account?    │
│ Sign In                     │
└────────────────────────────┘
```

These are layout references, not browser screenshots. A browser executable or reachable CDP target is unavailable in this environment, so desktop/mobile screenshots could not be captured here.

## Field specification

| Label | `name` | Input type | Browser requirements | Autocomplete |
|---|---|---|---|---|
| First Name | `firstName` | text | required, max 100 characters | `given-name` |
| Last Name | `lastName` | text | required, max 100 characters | `family-name` |
| Email Address | `email` | email | required, max 320 characters | `email` |

The form has no password, role, or approval-status field. It does not submit an API request in the UIX branch and does not display a success result unless its `status` is set to `success` by the integration.

## UI state contract

`RegistrationForm` in `app/page.tsx` accepts controlled presentation props:

```ts
type RegistrationStatus =
  | "idle" | "invalid" | "submitting" | "success"
  | "duplicate" | "rate-limited" | "unavailable" | "error";

type RegistrationPayload = {
  firstName: string;
  lastName: string;
  email: string;
};

type RegistrationFormProps = {
  status?: RegistrationStatus;
  fieldErrors?: Partial<Record<keyof RegistrationPayload, string>>;
  onRegister?: (payload: RegistrationPayload) => void;
  onSignIn?: () => void;
};
```

The Developer should provide `onRegister`, own the request state, and pass the resulting `status` and any `fieldErrors` back to the form. The UIX branch intentionally leaves `onRegister` unset; it contains no mock network response.

| API result/state | UI behavior |
|---|---|
| Default / idle | Show the three fields and Register button |
| Invalid / 400 | Highlight provided fields and show `Enter your first name, last name, and a valid email.` |
| Submitting | Disable fields and button; show `Registering…` |
| 201 / success | Show `Registration submitted. An admin must approve your account before you can sign in.`; do not sign in |
| 409 / duplicate | Show `Registration could not be completed for these details.` |
| 429 / rate-limited | Show `Too many registration attempts. Please try again later.` |
| 503 / unavailable | Show `Registration is temporarily unavailable. Please try again later.` |
| 500 / error | Show `Registration could not be completed. Please contact an administrator.` |

Success uses a polite live region; errors use an alert region. The Sign In link returns to the existing Login tab. The actual API mapping and behavior remain DEV-02 work on `dev`.

## Developer integration steps

1. After UIX changes are approved and merged into `setup/initial-project-structure`, bring that approved screen into `dev`.
2. Supply `onRegister` to send `{ firstName, lastName, email }` to `POST /api/register` and map its HTTP status to the `RegistrationStatus` above.
3. Keep server validation authoritative; do not add role selection, password collection, or automatic sign-in.
4. Verify success and error responses against the real backend before marking DEV-02 complete.
