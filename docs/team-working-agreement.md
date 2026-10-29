
# HOPE Inc. ERP — Team Working Agreement

**Sprint:** 1  
**Issue:** S1-SM-03  
**Status:** Proposed — Pending Team Review

## 1. Team Roles and Responsibilities

### Scrum Master — @zurielzantua
- Manage sprint tasks and GitHub issues.
- Track progress and blockers.
- Coordinate team reviews.
- Document team decisions.

### Developer — @gabrielzantua
- Implement application functionality using Next.js.
- Connect application features to Supabase.
- Implement authentication and user management.
- Follow the agreed database structure.

### DB Admin — @marcoasegurado
- Create and maintain database tables.
- Manage database migrations.
- Configure database access and RLS.
- Document database structures for development.

### UI/UX Designer — @ElishLim
- Create wireframes and interface designs.
- Define screen layouts and user interactions.
- Provide designs for implementation.

### Tester — @laurencechua
- Create test cases.
- Test implemented features.
- Report bugs and verify fixes.
- Document test results.

## 2. Account and Authentication Rules

The following rules must be confirmed before implementation.

### User Registration

Proposed rules based on the Sprint 1 requirements:

- New registrations receive the User role.
- New accounts start with Pending approval status.
- A Superadmin approves pending accounts.
- Pending and blocked accounts cannot access protected features.
- Public registration cannot assign Admin or Superadmin roles.

**Decision:** Pending team confirmation.

### Initial Superadmin Accounts

The project requires initial Superadmin accounts for team members.

- Superadmin accounts must be provisioned through an authorized process.
- Passwords must not be stored in GitHub.
- First-password setup uses a one-time link as required by the task plan.

**Provisioning method:** Pending team confirmation.

### Password Management

- Supabase Auth manages user authentication and passwords.
- The Developer and DB Admin must agree on how initial password setup and password recovery satisfy the project requirements.
- Password recovery must handle expiration and prevent reuse of recovery credentials.

**Implementation decision:** Pending team confirmation.

## 3. Git and GitHub Workflow

- Each task must have a GitHub issue.
- Members develop changes in feature branches.
- Pull Requests must reference their related issues.
- Another team member reviews the PR before merging.
- Changes should be tested or verified before approval.
- Approved changes are merged into the agreed integration branch.

## 4. Definition of Done (DoD)

A task is considered Done when:

1. Its requirements and acceptance criteria are satisfied.
2. The required code or document has been delivered.
3. Relevant verification or testing is complete.
4. A Pull Request is linked to the GitHub issue.
5. A teammate has reviewed and approved the PR.
6. The PR has been merged.
