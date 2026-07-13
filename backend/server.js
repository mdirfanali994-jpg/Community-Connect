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

            const imageFile = req.files?.image?.[0]?.filename || null;
            const voiceFile = req.files?.voice?.[0]?.filename || null;
            const newComplaint = {
                id: Date.now().toString(),
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
                date: new Date().toISOString()
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
                console.log("📤 [socket] emitting notification:new to room 'admin'");
                io.to('admin').emit('notification:new', notification);
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

// Get Complaints API
app.get('/api/complaints', ensureMongoConnected, async (req, res) => {
    const { userId, role } = req.query;

    let query = {};

    if (role === 'user' && userId) {
        query = { userId: parseInt(userId) };
    } else if (role === 'worker') {
        // Frontend expects only assignments to Bob Builder that are not completed.
        query = { assignedWorker: 'Bob Builder', status: { $ne: 'Completed' } };
    }

    const filteredComplaints = await Complaint.find(query).sort({ date: -1 }).lean();
    res.json({ success: true, complaints: filteredComplaints });
});

// Update Complaint Status API (Admin/Worker)
app.put('/api/complaints/:id', ensureMongoConnected, async (req, res) => {
    const { id } = req.params;
    const { status, assignedWorker, adminRemarks, expectedCompletionDate } = req.body;

    const update = {};
    if (status) update.status = status;
    if (assignedWorker !== undefined) update.assignedWorker = assignedWorker;
    if (adminRemarks !== undefined) update.adminRemarks = adminRemarks;
    if (expectedCompletionDate !== undefined) update.expectedCompletionDate = expectedCompletionDate;

    const updated = await Complaint.findOneAndUpdate({ id }, update, { new: true, lean: true });

    if (updated) {
        res.json({ success: true, complaint: updated });
    } else {
        res.status(404).json({ success: false, message: 'Complaint not found' });
    }
});

// Delete Complaint API (Admin only)
app.delete('/api/complaints/:id', ensureMongoConnected, async (req, res) => {
    const { id } = req.params;

    const deletedComplaint = await Complaint.findOneAndDelete({ id }).lean();

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
        res.status(404).json({ success: false, message: 'Complaint not found' });
    }
});

let customMapFilename = null;

// Map Settings API
app.get('/api/settings/map', (req, res) => {
    res.json({
        success: true,
        mapUrl: customMapFilename
            ? `https://community-connect-backend-wqwc.onrender.com/uploads/${customMapFilename}`
            : null
    });
});

app.post('/api/settings/map', upload.single('mapImage'), (req, res) => {
    try {
        if (req.file) {
            customMapFilename = req.file.filename;
            res.json({
                success: true,
                mapUrl: `https://community-connect-backend-wqwc.onrender.com/${customMapFilename}`
            });
        } else {
            res.status(400).json({ success: false, message: 'No image provided' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Role-based room join for future scalable notifications
  socket.on('joinRole', (payload = {}) => {
    const { role } = payload;
    console.log('🔌 [socket] joinRole received:', payload);
    if (!role) return;
    socket.join(role);
    console.log(`✅ [socket] socket ${socket.id} joined room '${role}'`);
  });


  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

