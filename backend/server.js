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

// In-memory data store for Prototype
const users = [
    { id: 1, email: 'user@test.com', password: 'password', role: 'user', name: 'John Doe', flat: 'A-101' },
    { id: 2, email: 'admin@test.com', password: 'password', role: 'admin', name: 'Admin User', flat: 'Admin' },
    { id: 3, email: 'worker@test.com', password: 'password', role: 'worker', name: 'Bob Builder', flat: 'Worker' }
];

// MongoDB (Atlas) integration
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Complaint = require('./models/Complaint');


const notificationRoutes = require('./routes/notificationRoutes');
const { createComplaintSubmittedNotification } = require('./services/notificationService');
const workerRoutes = require('./routes/workerRoutes');
const workerAssignmentRoutes = require('./routes/workerAssignmentRoutes');

const onboardingRoutes = require('./routes/onboardingRoutes');
const adminResidentRequestsRoutes = require('./routes/adminResidentRequestsRoutes');

dotenv.config();

// Notification routes (new)
app.use(notificationRoutes);

// Worker management routes (new)
app.use(workerRoutes);

// Worker assignment routes (new)
app.use(workerAssignmentRoutes);

// Society onboarding routes (new)
// IMPORTANT: onboardingRoutes already defines paths like /create-community and /join-community.
// Mount under /api/onboarding to match frontend calls.
app.use('/api/onboarding', onboardingRoutes);


// Admin resident request approval routes (new)
// Keep all admin approval REST endpoints under /api to match frontend calls.
app.use('/api', adminResidentRequestsRoutes);

const MONGODB_URI = process.env.MONGODB_URI;
let mongoConnected = false;

if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not set. Complaints endpoints will fail until configured.');
} else {
    mongoose
        .connect(MONGODB_URI, { autoIndex: true })
        .then(() => {
            mongoConnected = true;
            console.log('MongoDB connected');
        })
        .catch((err) => console.error('MongoDB connection error:', err));
}

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

        // 1) DB-backed login for CommunityUser (admin/resident/worker)
        // Keep this non-breaking: if not found, fall back to demo users.
        const dbUser = await CommunityUser.findOne({ email: normalizedEmail }).lean();
        if (dbUser) {
            // community onboarding users store bcrypt hashed passwords
            const bcrypt = require('bcryptjs');
            const ok = await bcrypt.compare(password, dbUser.password);
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

            const userWithoutPassword = {
                id: dbUser._id?.toString(),
                fullName: dbUser.fullName,
                name: dbUser.fullName,
                role: dbUser.role,
                block: dbUser.block,
                flat: dbUser.flatNumber,
                communityId: dbUser.communityId?.toString(),
                status: dbUser.status
            };

            // Attach communityName for dashboard UX (no tenant sharing since it's derived by communityId)
            try {
                const Community = require('./models/Community');
                const community = await Community.findOne({ _id: dbUser.communityId }).lean();
                if (community?.name) userWithoutPassword.communityName = community.name;
            } catch (e) {
                // Ignore; UI will fallback to "Your Society"
            }


            return res.json({ success: true, user: userWithoutPassword });
        }

        // 2) Existing Worker prototype login (legacy) is not in CommunityUser.
        // If demo/prototype worker exists in Mongo Worker collection, authenticate it too.
        // (This won't affect demo in-memory users.)
        const workerDb = await Worker.findOne({ email: normalizedEmail }).lean();
        if (workerDb) {
            const bcrypt = require('bcryptjs');
            const ok = await bcrypt.compare(password, workerDb.password);
            if (!ok) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            if (workerDb.status?.toLowerCase?.() === 'pending' || workerDb.status === 'Pending') {
                return res.status(403).json({ success: false, message: 'Your registration is waiting for Admin approval.' });
            }

            if (workerDb.status?.toLowerCase?.() === 'rejected' || workerDb.isActive === false) {
                return res.status(403).json({ success: false, message: 'Your registration was rejected by the Community Administrator.' });
            }

            return res.json({
                success: true,
                user: {
                    id: workerDb._id?.toString(),
                    name: workerDb.name,
                    role: 'worker',
                    workerId: workerDb._id?.toString(),
                    profession: workerDb.profession,
                    communityId: workerDb.societyId || null,
                    status: workerDb.status
                }
            });
        }

        // 3) Fallback to in-memory demo users for Spirit 1/2 compatibility
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            const { password, ...userWithoutPassword } = user;
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

            console.log("NEW COMPLAINT:");
            console.log(newComplaint);
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
    console.log("GET /api/complaints route reached");

    let query = {};
    let scopeCommunityId = null;

    if (role === 'user' || role === 'resident') {
        if (!userId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        const userDoc = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
        scopeCommunityId = userDoc?.communityId?.toString?.() || null;
        if (!scopeCommunityId) {
            return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
        }
        // Resident: only their own complaints
        query = { communityId: scopeCommunityId, userId: userId, status: { $in: ['Submitted','Verified','Assigned','Assigned to Worker','Work In Progress','Completed','Work In Progress'] } };
        // If older docs store numeric userId, fall back to filtering by userName/flat/userId is not safe.
        // Keep backward compatibility by also allowing legacy numeric userId match when needed.
        query = {
            communityId: scopeCommunityId,
            $or: [
                { userId: Number(userId) },
                { userId: userId }
            ]
        };
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
                ? `https://community-connect-backend-wqwc.onrender.com/uploads/${mapFilename}`
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
                mapUrl: `https://community-connect-backend-wqwc.onrender.com/uploads/${req.file.filename}`
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

