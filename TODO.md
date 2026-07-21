# Implementation Plan - Multi-Tenant Society Isolation Fixes

## Status: ALL FIXES IMPLEMENTED ✅

## Backend Fixes

### Fix 1: `backend/controllers/workerController.js` ✅
- [x] `createWorker`: Require admin identity headers, derive communityId from admin's community (never trust frontend)
- [x] `listWorkersForAssignment`: Derive communityId from admin identity headers instead of trusting query params

### Fix 2: `backend/models/Community.js` ✅
- [x] Add `mapFilename` field for per-society map storage

### Fix 3: `backend/server.js` ✅
- [x] Map settings: Store/retrieve per-society using Community model + x-community-id header
- [x] Require admin identity to set map

## Frontend Fixes

### Fix 4: `frontend/src/pages/AdminDashboard.jsx` ✅
- [x] `handleUpdate`: Pass admin identity headers
- [x] `handleMarkRead`: Pass admin identity headers
- [x] `handleMarkAllRead`: Pass admin identity headers  
- [x] `handleDelete`: Pass admin identity headers
- [x] `handleAssignWorker`: Pass admin identity headers
- [x] `handleMapUpload`: Pass admin identity headers

### Fix 5: `frontend/src/pages/WorkerDashboard.jsx` ✅
- [x] `handleStatusUpdate`: Pass worker identity info (role + userId)

### Fix 6: `frontend/src/pages/CommunityMap.jsx` ✅
- [x] Pass `role=user&userId=` params to GET /api/complaints

