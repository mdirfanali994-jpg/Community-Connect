# TODO - MongoDB Atlas migration (Complaints)

## Step 1: Analyze current backend complaint API
- Confirm routes: POST /api/complaints, GET /api/complaints, PUT /api/complaints/:id, DELETE /api/complaints/:id
- Identify fields used by frontend (id, userId, userName, flatNumber, text, image, voice, location, status, assignedWorker, expectedCompletionDate, adminRemarks, date)

## Step 2: Add MongoDB integration without changing frontend / APIs
- Add mongoose dependency (keep backend structure)
- Add env config loading (existing style) for MongoDB Atlas connection string

## Step 3: Create Complaint model
- Create Mongoose schema/model with the same shape as current in-memory complaint objects

## Step 4: Replace in-memory storage ✅
- Remove `let complaints = []` from server.js
- For create: save document to MongoDB
- For list: query MongoDB and apply same filtering + sorting logic
- For update: update document in MongoDB and return updated doc
- For delete: delete document in MongoDB, then delete associated uploaded files

## Step 5: Keep image and voice uploads working ✅
- Ensure multer storage stays the same
- Ensure deleted complaint removes image/voice files from /backend/uploads when they exist

## Step 6: Validate behavior parity (pending)
- Ensure response payloads still match what frontend expects: `res.json({ success: true, complaints: [...] })` etc.
- Ensure complaint `id` remains a string compatible with `c.id.substring(...)`

## Step 7: Run backend locally and sanity-check endpoints (pending)
- Start server
- Use sample requests to verify CRUD


