const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
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

dotenv.config();

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

// Login API
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
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

            const imageFile = req.files['image'] ? req.files['image'][0].filename : null;
            const voiceFile = req.files['voice'] ? req.files['voice'][0].filename : null;

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

            const saved = await Complaint.create(newComplaint);
            res.status(201).json({ success: true, complaint: saved.toObject() });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Server error' });
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

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

