\# HOPE Inc. ERP – Sprint 1 Bug Reports and Fix Verification



\*\*Role:\*\* Tester

\*\*Related issue:\*\* S1-TST-06 (#54) – Bug reports and fix verification

\*\*Scope:\*\* Defects found during Sprint 1 testing, and verification of their fixes

\*\*Status:\*\* 2 bugs recorded, 2 retested and Verified on 2026-11-23



> \*\*Status legend:\*\* Open / Fixed (ready to retest) / Verified / Reopened



\---



\## 1. Bug Reports



| Bug ID | Found in | Summary | Steps to reproduce | Expected result | Actual result (when found) | Severity | Issue # | Status |

|---|---|---|---|---|---|---|---|---|

| BUG-01 | REG-03 | An invalid email format was accepted on registration | 1. Open the register page. 2. Fill the required fields with an invalid email (exact value to confirm, for example `abc@` or `abc.com`). 3. Submit. | A validation error is shown and the form is not submitted | "Registration submitted. An admin must approve your account before you can sign in." | Medium | To be logged | Verified |

| BUG-02 | LOG-03 | Login with an unregistered email revealed the email is not registered | 1. Open the login page. 2. Enter an email that is not registered and any password. 3. Submit. | The same generic error as a wrong password: "Email or password is incorrect, or the account is not ready to sign in." | "Email unidentified" | Medium | To be logged | Verified |



\---



\## 2. Fix Verification



| Bug ID | Fix (PR or commit) | Retest steps | Retest result | Date verified | Status |

|---|---|---|---|---|---|

| BUG-01 | Not recorded (add the PR or commit) | Entered an invalid (fake) email on the register page and submitted | The site did not accept the fake email. A "wrong email format" message appeared beside the email box. | 2026-11-23 | Verified |

| BUG-02 | Not recorded (add the PR or commit) | Entered an unregistered email on the login page and submitted | The site responded "Email or password is incorrect, or the account is not ready to sign in.", the same message as a wrong password. | 2026-11-23 | Verified |



\---



\## 3. Items to Confirm (not yet bugs)



| Observation | Found in | What to confirm |

|---|---|---|

| Admins can make other users Admin | PRM-04 | Check the permission matrix. If only a Superadmin should designate Admins, record it as a bug. |

| System Settings appears for Admin and User roles, not only Superadmin | UI-01 | Check the permission matrix. If it should be restricted, record it as a bug. |



\---



\## 4. Summary



| Total bugs | Open | Fixed (ready to retest) | Verified | Reopened |

|---|---|---|---|---|

| 2 | 0 | 0 | 2 | 0 |



\## 5. Notes



\- Both bugs now behave as expected on retest. Add the PR or commit that fixed each one, and the issue numbers, once they are known.

\- The exact invalid email used in the BUG-01 retest was not recorded. Note it if the team asks for it.

\- The original REG-03 and LOG-03 results in `auth-test-cases.md` are marked Fail. Update them to Pass (retest) if that file is still open.

\- Add any new bugs from the server-side permission checks (SRV-01 to SRV-05) in the same format.

