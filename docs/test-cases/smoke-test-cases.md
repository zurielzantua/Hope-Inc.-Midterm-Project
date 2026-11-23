\# HOPE Inc. ERP – Automated Smoke Test Cases: Login and Main Page



\*\*Role:\*\* Tester

\*\*Scope:\*\* Quick checks that the login and main page (dashboard) work after each deployment

\*\*Environment:\*\* Deployed website

\*\*Execution date:\*\* 2026-11-23

\*\*Execution status:\*\* Executed manually with a User account (6 of 6 Pass). The automated script is not written yet.



> \*\*Status legend:\*\* Not Run / Pass / Fail / Blocked

> \*\*Pass criteria:\*\* all 6 cases pass on every run. If any case fails, the build is not considered healthy and the failure is reported.



\---



\## 1. Setup



| Item | Value |

|---|---|

| Base URL | (add the deployed site URL, read from a variable) |

| Test account | One dedicated approved test account (credentials stored in environment variables, never in the repo). Manual run used a User-role account. |

| Suggested tool | Playwright (or the tool the team already uses) |

| Run when | After each deployment, and before demos |



\---



\## 2. Smoke Test Cases



| ID | Test case | Steps (automated) | Expected result | Actual result | Status |

|---|---|---|---|---|---|

| SMK-01 | Login page loads | Open the base URL | The page loads without errors and shows the email field, password field, and sign-in button | After signing out and opening the website link again, the login page loads with no errors or problems. | Pass |

| SMK-02 | Login with valid credentials | Enter the test account's email and password, click sign in | The user is redirected to the main page (dashboard) | Logged in with the User account and was directed straight to the dashboard with no problems. | Pass |

| SMK-03 | Login with a wrong password | Enter the test email with a wrong password, click sign in | An error message is shown and the user stays on the login page | Logged in with the same account and a wrong password. The system showed "Email or password is incorrect, or the account is not ready to sign in." | Pass |

| SMK-04 | Main page loads after login | After SMK-02, wait for the main page | The dashboard and navigation menu are visible, with no failed requests or console errors, and the page loads within 5 seconds | Logged out and logged in again with the User account. The dashboard loaded within 4 seconds with no problems noted. The console and network tabs were not specifically recorded. | Pass |

| SMK-05 | Logout | Click logout from the main page | The session ends and the user returns to the login page | Clicked logout and was logged out of the website with no errors or problems. | Pass |

| SMK-06 | Main page blocked when signed out | After SMK-05, open the main page URL directly | The user is redirected to the login page and no dashboard data is shown | Copied the dashboard URL while logged in, logged out, and pasted it. The dashboard did not open and the page stayed on the login page. | Pass |



\---



\## 3. Test Summary



| Total | Pass | Fail | Blocked | Not Run |

|---|---|---|---|---|

| 6 | 6 | 0 | 0 | 0 |



\## 4. Notes



\- These results come from a manual run. The cases are written to be automated, and the automated script still needs to be created and run.

\- SMK-04 did not record the browser console or network tab. Check them in the automated run (no failed requests or console errors).

\- Run the cases in order, since SMK-04 to SMK-06 depend on the login from SMK-02.

\- Use a dedicated test account and keep its credentials in environment variables or the CI secrets, not in the test files.

\- Add the exact page text, button labels, and URLs the checks should look for once the automation is written.

