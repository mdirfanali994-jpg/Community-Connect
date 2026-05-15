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
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// In-memory data store for Prototype
const users = [
    { id: 1, email: 'user@test.com', password: 'password', role: 'user', name: 'John Doe', flat: 'A-101' },
    { id: 2, email: 'admin@test.com', password: 'password', role: 'admin', name: 'Admin User', flat: 'Admin' },
    { id: 3, email: 'worker@test.com', password: 'password', role: 'worker', name: 'Bob Builder', flat: 'Worker' }
];

let complaints = [];

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
app.post('/api/complaints', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'voice', maxCount: 1 }]), (req, res) => {
    try {
        const { text, userId, userName, flatNumber, location } = req.body;
        
        let imageFile = req.files['image'] ? req.files['image'][0].filename : null;
        let voiceFile = req.files['voice'] ? req.files['voice'][0].filename : null;

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

        complaints.push(newComplaint);
        res.status(201).json({ success: true, complaint: newComplaint });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Complaints API
app.get('/api/complaints', (req, res) => {
    const { userId, role } = req.query;
    
    let filteredComplaints = complaints;
    
    if (role === 'user' && userId) {
        filteredComplaints = complaints.filter(c => c.userId === parseInt(userId));
    } else if (role === 'worker') {
        filteredComplaints = complaints.filter(c => c.assignedWorker === 'Bob Builder' && c.status !== 'Completed');
    }
    
    // Sort descending by date
    filteredComplaints.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ success: true, complaints: filteredComplaints });
});

// Update Complaint Status API (Admin/Worker)
app.put('/api/complaints/:id', (req, res) => {
    const { id } = req.params;
    const { status, assignedWorker, adminRemarks, expectedCompletionDate } = req.body;
    
    const complaintIndex = complaints.findIndex(c => c.id === id);
    
    if (complaintIndex !== -1) {
        if (status) complaints[complaintIndex].status = status;
        if (assignedWorker !== undefined) complaints[complaintIndex].assignedWorker = assignedWorker;
        if (adminRemarks !== undefined) complaints[complaintIndex].adminRemarks = adminRemarks;
        if (expectedCompletionDate !== undefined) complaints[complaintIndex].expectedCompletionDate = expectedCompletionDate;
        
        res.json({ success: true, complaint: complaints[complaintIndex] });
    } else {
        res.status(404).json({ success: false, message: 'Complaint not found' });
    }
});

// Delete Complaint API (Admin only)
app.delete('/api/complaints/:id', (req, res) => {
    const { id } = req.params;
    
    const complaintIndex = complaints.findIndex(c => c.id === id);
    
    if (complaintIndex !== -1) {
        const deletedComplaint = complaints.splice(complaintIndex, 1)[0];
        
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
    res.json({ success: true, mapUrl: customMapFilename ? `https://community-connect-xsvo.onrender.com/uploads/${customMapFilename}` : null });
});

app.post('/api/settings/map', upload.single('mapImage'), (req, res) => {
    try {
        if (req.file) {
            customMapFilename = req.file.filename;
            res.json({ success: true, mapUrl: `https://community-connect-xsvo.onrender.com/${customMapFilename}` });
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
