const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Storage for multer


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// In-memory data store for Prototype (fallback when MongoDB is not connected)
const users = [
    { id: 1, email: 'resident@test.com', password: 'resident123', role: 'resident', name: 'John Doe', flat: 'A-101', communityName: null, communityId: null },
    { id: 2, email: 'admin@test.com', password: 'admin123', role: 'admin', name: 'Admin User', flat: 'Admin', communityName: null, communityId: null },
    { id: 3, email: 'worker@test.com', password: 'worker123', role: 'worker', name: 'Bob Builder', flat: 'Worker', communityName: null, communityId: null }
];

// MongoDB (Atlas) integration
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Complaint = require('./models/Complaint');


dotenv.config();

const notificationRoutes = require('./routes/notificationRoutes');
const { createComplaintSubmittedNotification } = require('./services/notificationService');
const workerRoutes = require('./routes/workerRoutes');
const workerAssignmentRoutes = require('./routes/workerAssignmentRoutes');

const onboardingRoutes = require('./routes/onboardingRoutes');
const adminResidentRequestsRoutes = require('./routes/adminResidentRequestsRoutes');
const financeRoutes = require('./routes/financeRoutes');
const visitorRoutes = require('./routes/visitorRoutes');

// Pass Socket.IO and notification service to controllers
const { setIO: setWorkerIO, setNotificationService } = require('./controllers/workerController');
const { setIO: setAssignmentIO } = require('./controllers/workerAssignmentController');
const { setIO: setVisitorIO } = require('./controllers/visitorController');

setWorkerIO(io);
setAssignmentIO(io);
setVisitorIO(io);
setNotificationService({ createComplaintSubmittedNotification });

// Notification routes (new)
app.use(notificationRoutes);

// Worker management routes (new)
app.use(workerRoutes);

// Worker assignment routes (new)
app.use(workerAssignmentRoutes);

// Visitor management routes (Phase 4, Module 2)
// Routes define full /api/visitors paths internally.
app.use(visitorRoutes);

// Society onboarding routes (new)
// IMPORTANT: onboardingRoutes already defines paths like /create-community and /join-community.
// Mount under /api/onboarding to match frontend calls.
app.use('/api/onboarding', onboardingRoutes);


// Admin resident request approval routes (new)
// Keep all admin approval REST endpoints under /api to match frontend calls.
app.use('/api', adminResidentRequestsRoutes);

// Finance & Maintenance routes (Phase 4, Module 1)
// Routes define full /api/finance paths internally.
app.use(financeRoutes);

const MONGODB_URI = process.env.MONGODB_URI;
let mongoConnected = false;
let mongoConnectionAttempted = false;
let mongodServer = null;

async function startMongo() {
    if (!MONGODB_URI) {
        console.warn('MONGODB_URI is not set. Trying mongodb-memory-server...');
        await startMemoryMongo();
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            autoIndex: true,
            serverSelectionTimeoutMS: 3000,
            connectTimeoutMS: 3000,
        });
        mongoConnected = true;
        console.log('MongoDB connected to:', MONGODB_URI);
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        console.log('Falling back to mongodb-memory-server...');
        await startMemoryMongo();
    }
}

async function startMemoryMongo() {
    try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodServer = await MongoMemoryServer.create();
        const uri = mongodServer.getUri();
        console.log('MongoMemoryServer started at:', uri);
        await mongoose.connect(uri, {
            autoIndex: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        mongoConnected = true;
        console.log('MongoDB connected to in-memory instance');
    } catch (memErr) {
        console.error('Failed to start mongodb-memory-server:', memErr.message);
        console.log('Server will run with in-memory data only.');
    }
}

// Start MongoDB connection
startMongo();

const ensureMongoConnected = (req, res, next) => {
    if (!mongoConnected) {
        return res.status(500).json({ success: false, message: 'MongoDB not connected' });
    }
    next();
};

// Login API (DB-backed for newly onboarded users; fallback to in-memory demo users)
const CommunityUser = require('./models/CommunityUser');
const Worker = require('./models/Worker');

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        console.log("========== LOGIN REQUEST ==========");
        console.log("EMAIL RECEIVED:", normalizedEmail);
        console.log("PASSWORD RECEIVED:", password);
         
        // PRIORITY 1: If MongoDB is connected, query DB first
        if (mongoConnected) {
            // Check CommunityUser collection (admin, resident, onboarded worker)
            const dbUser = await CommunityUser.findOne({ email: normalizedEmail }).lean();
            console.log("DB USER FOUND:", dbUser);
            if (dbUser) {
                const bcrypt = require('bcryptjs');
                console.log("HASH FROM DB:", dbUser.password);
                const ok = await bcrypt.compare(password, dbUser.password);
                console.log("PASSWORD MATCH:", ok);
                if (!ok) {
                    return res.status(401).json({ success: false, message: 'Invalid credentials' });
                }

                if (dbUser.status === 'pending') {
                    return res.status(403).json({
                        success: false,
                        message: 'Your registration is waiting for Admin approval.'
                    });
                }

                if (dbUser.status === 'rejected' || dbUser.isActive === false) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your registration was rejected by the Community Administrator.'
                    });
                }

                // Lookup community name
                const Community = require('./models/Community');
                let communityName = null;
                try {
                    const community = await Community.findById(dbUser.communityId).lean();
                    communityName = community?.name || null;
                } catch (e) {
                    console.error(`Community lookup failed for id ${dbUser.communityId}:`, e.message);
                }

                const userWithoutPassword = {
                    id: dbUser._id?.toString(),
                    fullName: dbUser.fullName,
                    name: dbUser.fullName,
                    role: dbUser.role,
                    block: dbUser.block,
                    flat: dbUser.flatNumber,
                    communityId: dbUser.communityId?.toString(),
                    communityName: communityName,
                    status: dbUser.status
                };

                return res.json({ success: true, user: userWithoutPassword });
            }

            // Check Worker collection
            const workerDb = await Worker.findOne({ email: normalizedEmail }).lean();
            if (workerDb) {
                const bcrypt = require('bcryptjs');
                const ok = await bcrypt.compare(password, workerDb.password);
                if (!ok) {
                    return res.status(401).json({ success: false, message: 'Invalid credentials' });
                }

                if (workerDb.status === 'Pending') {
                    return res.status(403).json({ success: false, message: 'Your registration is awaiting approval from the Society Admin.' });
                }

                if (workerDb.status === 'Rejected' || workerDb.isActive === false) {
                    return res.status(403).json({
                        success: false,
                        message: workerDb.rejectionReason
                            ? `Your registration was rejected: ${workerDb.rejectionReason}`
                            : 'Your registration was rejected by the Community Administrator.'
                    });
                }

                if (workerDb.status === 'Suspended') {
                    return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the Community Administrator.' });
                }

const workerCommunityId = workerDb.communityId?.toString?.() || workerDb.societyId || null;

                // Determine worker role (for role-based dashboards)
                const { professionToRole } = require('./constants/workerRoles');
                const workerRole = workerDb.role || professionToRole(workerDb.profession);

                let workerCommunityName = null;
                if (workerCommunityId) {
                    try {
                        const Community = require('./models/Community');
                        const community = await Community.findById(workerCommunityId).lean();
                        workerCommunityName = community?.name || null;
                    } catch (e) {
                        console.error(`Worker community lookup failed for id ${workerCommunityId}:`, e.message);
                    }
                }

                return res.json({
                    success: true,
                    user: {
                        id: workerDb._id?.toString(),
                        name: workerDb.name,
                        role: 'worker',
                        workerId: workerDb._id?.toString(),
                        profession: workerDb.profession,
                        workerRole,
                        communityId: workerCommunityId,
                        communityName: workerCommunityName,
                        status: workerDb.status
                    }
                });
            }
        }

        // PRIORITY 2: Fallback to in-memory demo users (MongoDB not connected, or user not found in DB)
        const demoUser = users.find(u => u.email === email && u.password === password);
        if (demoUser) {
            const { password: _, ...userWithoutPassword } = demoUser;
            return res.json({ success: true, user: userWithoutPassword });
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Create Complaint API
app.post(
    '/api/complaints',
    ensureMongoConnected,
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'voice', maxCount: 1 }]),
    async (req, res) => {
        try {
    const { text, userId, userName, flatNumber, location } = req.body;

            // Tenant isolation: never trust frontend-sent communityId.
            // This backend currently has no JWT middleware; it relies on req.query/req.body userId.
            // We will strictly derive communityId from CommunityUser below.

            // Derive communityId from logged-in user on the backend (from DB)
            // NOTE: CommunityUser._id is a MongoDB ObjectId (not numeric)
            const userDoc = await CommunityUser.findOne({
                _id: userId,
                role: 'resident'
            }).lean();

            const derivedCommunityId = userDoc?.communityId?.toString?.() || null;

            // Hard requirement: never allow creation without a valid communityId.
            // Prevents legacy/null docs from being queried across tenants.
            if (!derivedCommunityId) {
                return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
            }

            const imageFile = req.files?.image?.[0]?.filename || null;
            const voiceFile = req.files?.voice?.[0]?.filename || null;


    const newComplaint = {
                id: Date.now().toString(),
                communityId: derivedCommunityId,
                userId: parseInt(userId),
                userName,
                flatNumber,
                text,
                image: imageFile,
                voice: voiceFile,
                location: location ? JSON.parse(location) : null,
                status: 'Submitted', // Submitted, Verified, Assigned to Worker, Work In Progress, Completed
                assignedWorker: null,
                expectedCompletionDate: null,
                adminRemarks: '',
                // Backward compatible: existing UI uses `date`; also populate `createdAt` for tenant validation.
                date: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            const saved = await Complaint.create(newComplaint);

            // Create a role-based notification for Admins and emit via Socket.IO (real-time).
            // Note: we keep complaint REST behavior unchanged.
            try {
                const notification = await createComplaintSubmittedNotification({ complaint: saved.toObject ? saved.toObject() : saved });
                console.log('✅ [notification] created:', {
                    notificationId: notification?._id || notification?.id,
                    targetRole: notification?.targetRole
                });
                const communityId = notification?.communityId ? String(notification.communityId) : null;
                const room = communityId ? `admin:${communityId}` : 'admin:unknown';
                console.log("📤 [socket] emitting notification:new to room", room);
                io.to(room).emit('notification:new', notification);

            } catch (notifyErr) {
                console.error('Notification emit error:', notifyErr);
            }


            res.status(201).json({ success: true, complaint: saved.toObject() });
        } catch (error) {
             console.error("FULL ERROR:");
             console.error(error);


             res.status(500).json({
             success: false,
             message: error.message,
             stack: error.stack
    });
}
        }
    
);

// Get Complaints API (community-scoped)
app.get('/api/complaints', ensureMongoConnected, async (req, res) => {
    const { userId, role } = req.query;

    let query = {};
    let scopeCommunityId = null;

    if (role === 'user' || role === 'resident') {
        if (!userId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        // Look up the resident's community. Use try/catch because userId may be
        // a numeric string (from demo users like "1") which is not a valid ObjectId.
        try {
            const userDoc = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
            scopeCommunityId = userDoc?.communityId?.toString?.() || null;
        } catch (lookupErr) {
            scopeCommunityId = null;
        }
        if (!scopeCommunityId) {
            // Fallback (demo users like { id: 1 } have no communityId).
            // Query by userId only, without community scoping.
            // Use parseInt to match how POST /api/complaints stores userId (parseInt(userId)).
            query = {
                $or: [
                    { userId: parseInt(userId) },
                    { userId: userId }
                ]
            };
            const filteredComplaints = await Complaint.find(query).sort({ date: -1 }).lean();
            return res.json({ success: true, complaints: filteredComplaints });
        }
        // Use parseInt to extract any leading numeric portion from ObjectId strings,
        // matching how POST /api/complaints stores userId (parseInt(userId)).
        // Only include the raw userId string in the $or if it's numeric (for demo users),
        // otherwise Mongoose will throw CastError since the schema defines userId as Number.
        const parsedUserId = parseInt(userId);
        const isNumericString = /^\d+$/.test(userId);
        if (isNumericString) {
            query = {
                communityId: scopeCommunityId,
                $or: [
                    { userId: parsedUserId },
                    { userId: userId }
                ]
            };
        } else {
            // Real onboarded users have ObjectId strings; only query by parsed numeric portion.
            query = { communityId: scopeCommunityId, userId: parsedUserId };
        }
    } else if (role === 'worker') {
        if (!userId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        const workerDoc = await Worker.findOne({ _id: String(userId), isActive: true }).lean();
        scopeCommunityId = workerDoc?.communityId?.toString?.() || null;
        if (!scopeCommunityId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        query = {
            communityId: scopeCommunityId,
            $or: [
                { 'assignment.workerId': String(userId) },
                { assignedWorker: workerDoc?.name || null }
            ],
            status: { $ne: 'Completed' }
        };
    } else {
        // Admin: validate identity via headers
        const xAdminId = req.headers['x-admin-id'];
        const xCommunityId = req.headers['x-community-id'];
        if (!xAdminId || !xCommunityId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
        scopeCommunityId = admin?.communityId?.toString?.() || null;
        if (!scopeCommunityId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        query = { communityId: scopeCommunityId };
    }

    const filteredComplaints = await Complaint.find(query).sort({ date: -1 }).lean();
    return res.json({ success: true, complaints: filteredComplaints });
});


// Update Complaint Status API (Admin/Worker) - community-scoped
app.put('/api/complaints/:id', ensureMongoConnected, async (req, res) => {
    const { id } = req.params;
    const { status, assignedWorker, adminRemarks, expectedCompletionDate } = req.body;

    // Derive requester community strictly from identity, never from frontend.
    const xAdminId = req.headers['x-admin-id'];
    const xCommunityId = req.headers['x-community-id'];

    let scopeCommunityId = null;

    // Admin scope
    if (xAdminId && xCommunityId) {
        const admin = await CommunityUser.findOne({
            _id: xAdminId,
            role: 'admin',
            communityId: xCommunityId
        }).lean();
        scopeCommunityId = admin?.communityId?.toString?.() || null;
    }

    // Resident/worker legacy scope
    if (!scopeCommunityId) {
        const candidateUserId = req.query?.userId || req.body?.userId;
        const role = req.query?.role || req.body?.role;
        if (candidateUserId && role === 'resident') {
            const userDoc = await CommunityUser.findOne({ _id: candidateUserId, role: 'resident' }).lean();
            scopeCommunityId = userDoc?.communityId?.toString?.() || null;
        } else if (candidateUserId && role === 'worker') {
            const workerDoc = await Worker.findOne({ _id: String(candidateUserId) }).lean();
            scopeCommunityId = workerDoc?.communityId?.toString?.() || null;
        }
    }


    if (!scopeCommunityId) {
        return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const update = {};
    if (status) update.status = status;
    if (assignedWorker !== undefined) update.assignedWorker = assignedWorker;
    if (adminRemarks !== undefined) update.adminRemarks = adminRemarks;
    if (expectedCompletionDate !== undefined) update.expectedCompletionDate = expectedCompletionDate;

    const updated = await Complaint.findOneAndUpdate(
        { id, communityId: scopeCommunityId },
        update,
        { new: true, lean: true }
    );

    if (updated) {
        res.json({ success: true, complaint: updated });
    } else {
        // Do not leak existence across communities
        res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }
});

// Delete Complaint API (Admin only)
app.delete('/api/complaints/:id', ensureMongoConnected, async (req, res) => {
    const { id } = req.params;

    // Derive requester community strictly from identity (admin/resident/worker), never from arbitrary frontend values.
    const xAdminId = req.headers['x-admin-id'];
    const xCommunityId = req.headers['x-community-id'];

    let scopeCommunityId = null;

    // Admin scope
    if (xAdminId && xCommunityId) {
        const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
        scopeCommunityId = admin?.communityId?.toString?.() || null;
    }

    // Resident/worker legacy scope
    if (!scopeCommunityId) {
        const candidateUserId = req.query?.userId || req.body?.userId;
        const role = req.query?.role || req.body?.role;

        if (candidateUserId && role === 'resident') {
            const userDoc = await CommunityUser.findOne({ _id: candidateUserId, role: 'resident' }).lean();
            scopeCommunityId = userDoc?.communityId?.toString?.() || null;
        } else if (candidateUserId && role === 'worker') {
            const workerDoc = await Worker.findOne({ _id: String(candidateUserId) }).lean();
            scopeCommunityId = workerDoc?.communityId?.toString?.() || null;
        }
    }

    if (!scopeCommunityId) {
        return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }


    const deletedComplaint = await Complaint.findOneAndDelete({ id, communityId: scopeCommunityId }).lean();

    if (deletedComplaint) {
        // Also delete associated files if they exist
        if (deletedComplaint.image) {
            const imagePath = path.join(__dirname, 'uploads', deletedComplaint.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        if (deletedComplaint.voice) {
            const voicePath = path.join(__dirname, 'uploads', deletedComplaint.voice);
            if (fs.existsSync(voicePath)) {
                fs.unlinkSync(voicePath);
            }
        }

        res.json({ success: true, message: 'Complaint deleted successfully' });
    } else {
        // Do not leak existence across communities
        res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }
});

const Community = require('./models/Community');

// Map Settings API — per-society
app.get('/api/settings/map', ensureMongoConnected, async (req, res) => {
    try {
        // Derive communityId from identity headers
        const xAdminId = req.headers['x-admin-id'];
        const xCommunityId = req.headers['x-community-id'];
        const communityId = xCommunityId || null;

        if (!communityId) {
            return res.json({ success: true, mapUrl: null });
        }

        const community = await Community.findById(communityId).select({ mapFilename: 1 }).lean();
        const mapFilename = community?.mapFilename || null;

        res.json({
            success: true,
            mapUrl: mapFilename
                ? `/uploads/${mapFilename}`
                : null
        });
    } catch (error) {
        console.error('GET /api/settings/map error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/settings/map', ensureMongoConnected, upload.single('mapImage'), async (req, res) => {
    try {
        // Require admin identity to set per-society map
        const xAdminId = req.headers['x-admin-id'];
        const xCommunityId = req.headers['x-community-id'];
        if (!xAdminId || !xCommunityId) {
            return res.status(403).json({ success: false, message: 'Forbidden: admin identity required' });
        }
        // Verify admin belongs to this community
        const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Forbidden: invalid admin identity' });
        }

        if (req.file) {
            await Community.findByIdAndUpdate(xCommunityId, { mapFilename: req.file.filename });
            res.json({
                success: true,
                mapUrl: `/uploads/${req.file.filename}`
            });
        } else {
            res.status(400).json({ success: false, message: 'No image provided' });
        }
    } catch (error) {
        console.error('POST /api/settings/map error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Role-based room join for future scalable notifications
  socket.on('joinRole', (payload = {}) => {
    const { role, communityId } = payload;
    console.log('🔌 [socket] joinRole received:', payload);
    if (!role) return;

    // Legacy room for role-only listeners
    socket.join(role);
    console.log(`✅ [socket] socket ${socket.id} joined room '${role}'`);

    // If communityId is provided, also join community-scoped rooms
    if (communityId) {
      socket.join(`${role}:${communityId}`);
      console.log(`✅ [socket] socket ${socket.id} joined room '${role}:${communityId}'`);
    }
  });

  socket.on('joinCommunity', (payload = {}) => {
    const { communityId, role } = payload;
    if (!communityId || !role) return;

    socket.join(`${role}:${communityId}`);
    console.log(`✅ [socket] socket ${socket.id} joined room '${role}:${communityId}' via joinCommunity`);
  });



  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
