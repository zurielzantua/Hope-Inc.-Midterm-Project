\# HOPE Inc. ERP – Authentication Test Cases (Sprint 1)



\*\*Role:\*\* Tester

\*\*Scope:\*\* Registration, login/logout, first-password setup, password reset

\*\*Branch:\*\* `tester`

\*\*Execution date:\*\* 2026-11-05

\*\*Execution status:\*\* Partially executed. 11 of 23 cases run (9 Pass, 2 Fail). First-password setup and password reset cases are Not Run.



> \*\*Status legend:\*\* Not Run / Pass / Fail / Blocked



\---



\## 1. Registration, Login and Logout



| ID | Test case | Steps | Expected result | Actual result | Status |

| --- | --- | --- | --- | --- | --- |

| REG-01 | Register with valid details | Fill all required fields with valid data, submit | Account created, success message or confirmation shown | "Registration submitted. An admin must approve your account before you can sign in." | Pass |

| REG-02 | Register with an existing email | Use an email that is already registered | Error shown, no duplicate account | Shows "registration could not be completed for these details." Using a different email works. | Pass |

| REG-03 | Register with an invalid email format | Enter `abc@` or `abc.com` | Validation error, form not submitted | Showed "Registration submitted. An admin must approve your account before you can sign in." (exact input used: to be confirmed) | Fail |

| REG-04 | Register with empty required fields | Leave fields blank, submit | Field-level required errors | "Please fill out this field." | Pass |

| LOG-01 | Login with valid credentials | Enter correct email and password | Redirected to the dashboard | Directed to the dashboard. | Pass |

| LOG-02 | Login with a wrong password | Correct email, wrong password | Generic error, no session created | "Email or password is incorrect, or the account is not ready to sign in." | Pass |

| LOG-03 | Login with an unregistered email | Email not in the system | Generic error that doesn't reveal whether the email exists | Showed "Email unidentified", which differs from the wrong-password message and reveals the email is not registered. | Fail |

| LOG-04 | Login with empty fields | Submit blank form | Validation errors | "Please fill out this field." | Pass |

| OUT-01 | Logout | Click logout while signed in | Session ended, redirected to login | Session ended, redirected to login. | Pass |

| OUT-02 | Access a protected page after logout | Press Back or open the dashboard URL directly | Redirected to login, no data shown | After logout, a refresh did not return to the dashboard. Back button not separately tested. | Pass |

| OUT-03 | Access a protected page without logging in | Open the dashboard URL in a fresh session | Redirected to login | Needs to sign in again. | Pass |



\---



\## 2. First-Password Setup and Password Reset



| ID | Test case | Steps | Expected result | Actual result | Status |

| --- | --- | --- | --- | --- | --- |

| PWD-01 | Set first password with a valid link | Open the setup link, enter a valid password and confirmation | The password is successfully stored, allowing the user to sign in | | Not Run |

| PWD-02 | Passwords don't match | Enter different values in password and confirm | An error occurs, and the password is not saved | | Not Run |

| PWD-03 | Password violates the policy | Too short or missing required characters | A validation error is displayed detailing the specific rules | | Not Run |

| PWD-04 | Set password with an expired token | Open a setup link after it expires | An error indicates that the link has expired and provides a choice to generate a new one | | Not Run |

| PWD-05 | Set password with a reused token | Use the same setup link twice | The second attempt is declined | | Not Run |

| RST-01 | Request a reset for a registered email | Submit the email on the forgot-password page | A reset email is dispatched, and a confirmation message appears | | Not Run |

| RST-02 | Request a reset for an unregistered email | Submit an unknown email | The identical confirmation message as RST-01 is displayed to prevent exposing whether the account exists | | Not Run |

| RST-03 | Reset with a valid token | Open the link, enter a new password | The password is successfully updated, enabling the user to sign in using the new credentials | | Not Run |

| RST-04 | Reset with an expired token | Use a link past its expiry | An error occurs, and the password remains unmodified | | Not Run |

| RST-05 | Reset with a reused token | Use a link that was already used successfully | The request is declined, leaving the password unchanged | | Not Run |

| RST-06 | Old password after reset | Try logging in with the old password | The sign-in attempt is unsuccessful | | Not Run |

| RST-07 | Tampered or invalid token | Edit the token in the URL | An error occurs, and no modification is made to the password | | Not Run |



\---



\## 3. Test Summary



| Module | Total | Pass | Fail | Blocked | Not Run |

| --- | --- | --- | --- | --- | --- |

| Registration | 4 | 3 | 1 | 0 | 0 |

| Login | 4 | 3 | 1 | 0 | 0 |

| Logout / Access Control | 3 | 3 | 0 | 0 | 0 |

| First-Password Setup | 5 | 0 | 0 | 0 | 5 |

| Password Reset | 7 | 0 | 0 | 0 | 7 |

| \*\*Total\*\* | \*\*23\*\* | \*\*9\*\* | \*\*2\*\* | \*\*0\*\* | \*\*12\*\* |



\## 4. Defects Found



| Defect ID / Issue # | Related test case | Summary | Severity | Status |

| --- | --- | --- | --- | --- |

| To be logged | REG-03 | An invalid email format appears to be accepted on registration; the "Registration submitted" message is shown instead of a validation error. Confirm the exact input used. | Medium | Open |

| To be logged | LOG-03 | Login with an unregistered email shows "Email unidentified", which differs from the generic wrong-password message and reveals which emails are not registered. | Medium | Open |



Log failures using `ISSUE\_TEMPLATE.md`: steps to reproduce, expected result, actual result.



\## 5. Notes



\- OUT-02 was checked with a refresh after logout. The browser Back button can be tried as a follow-up.

\- REG-02 uses a generic message that does not confirm the email is already registered. LOG-03 should follow the same approach.

\- First-password setup and password reset cases are pending. Expired-token cases (PWD-04, RST-04) need either waiting out the expiry or a shorter expiry in the dev environment from the DB Admin.

