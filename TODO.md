## TODO - Real-Time Admin Complaint Notifications (First Sprint)

### Plan tasks
- [ ] Create MongoDB Notification model (reusable schema)
- [ ] Add notification persistence logic triggered by complaint creation
- [ ] Add Socket.IO admin-room emission for new notifications
- [ ] Add notification REST endpoints (fetch + mark read/read-all) without modifying existing complaint APIs
- [ ] Create reusable Socket.IO client service in frontend (do not connect in component)
- [ ] Build reusable notification UI component with bell/badge/dropdown/actions
- [ ] Integrate notification component into AdminDashboard header
- [ ] Wire real-time updates into notifications state
- [ ] Ensure notifications persist after refresh/login
- [x] Sanity test: resident submits complaint -> admin gets instant notification


