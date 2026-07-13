# TODO - COMMUNITY CONNECT – SPIRIT 3

## Phase 1 (Backend) — Schema + Approvals + AuthZ (preserve Spirit 1/2)
- [ ] Inspect existing auth/login usage and confirm how users are stored.
- [ ] Remove reliance on in-memory prototype users for authentication OR keep compatibility while adding DB-backed login for CommunityUser/Workers/Residents.
- [ ] Extend `Community` schema to store blocks/floors/flats, society boundary polygon, emergency contact, logo, map location.
- [ ] Update `onboardingController.createCommunity` to store those fields and create admin user as approved for that community.
- [ ] Enforce single-community constraint per email (no switching communities without admin action).
- [ ] Add resident request scoping: approve/reject endpoints must verify admin manages the same community.
- [ ] Add worker registration (DB-backed) + status pending/approved/rejected.
- [ ] Add worker pending request listing + approve/reject APIs for admins.
- [ ] Scope complaints assignment and listing by community (workers only see their community).
- [ ] Ensure all APIs validate input and return production-grade error messages.

## Phase 2 (Frontend) — Registration flows + Login gating + Admin tables
- [ ] Update Login page to call DB-backed auth and block pending users with "waiting for Admin approval".
- [ ] Add worker registration flow page(s) and update OnboardingLanding.
- [ ] Update AdminDashboard to show Pending Residents and Pending Workers with Approve/Reject.
- [ ] Update UserDashboard/WorkerDashboard access gating based on status.
- [ ] Ensure all fetches hit correct backend APIs and preserve existing complaint functionality.

## Phase 3 (Integration & Testing) — End-to-end verification
- [ ] End-to-end smoke test: Admin creates community.
- [ ] Resident registers → pending → cannot login.
- [ ] Admin approves → resident can login and access only their community.
- [ ] Worker registers → pending → cannot login.
- [ ] Admin approves worker → worker can login and only receives assigned community complaints.
- [ ] Regression check: complaints submission/update/delete still works.

