const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

// Allowed file types: images, PDF, DOCX
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only images, PDF and DOCX are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Persistent Storage (MongoDB) ──────────────────────────────────────────────

const uploadFileSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true, index: true },
  originalName: { type: String, default: '' },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: () => new Date() },
}, { versionKey: false });

let UploadFile = null;

function getUploadFileModel() {
  if (!UploadFile) {
    try {
      UploadFile = mongoose.model('UploadFile');
    } catch (_) {
      UploadFile = mongoose.model('UploadFile', uploadFileSchema);
    }
  }
  return UploadFile;
}

/**
 * Save a file buffer to MongoDB for durable storage.
 * Called after multer writes to disk, so the file survives Render restarts.
 */
async function persistFileToMongo(filename, buffer, metadata = {}) {
  try {
    const Model = getUploadFileModel();
    await Model.findOneAndUpdate(
      { filename },
      {
        filename,
        originalName: metadata.originalName || '',
        mimeType: metadata.mimeType || 'application/octet-stream',
        size: metadata.size || buffer.length,
        data: buffer,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('persistFileToMongo error:', err);
  }
}

/**
 * Retrieve a file buffer from MongoDB by filename.
 */
async function getFileFromMongo(filename) {
  try {
    const Model = getUploadFileModel();
    const doc = await Model.findOne({ filename }).lean();
    if (doc && doc.data) {
      doc.data = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data);
    }
    return doc;
  } catch (err) {
    console.error('getFileFromMongo error:', err);
    return null;
  }
}

/**
 * Express middleware: after multer writes file(s) to disk, persist each to MongoDB.
 * Handles req.file (single) and req.files (array or fields object).
 */
async function persistUploadedFiles(req, res, next) {
  try {
    const files = [];
    if (req.file) {
      files.push(req.file);
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        for (const key of Object.keys(req.files)) {
          const arr = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];
          files.push(...arr);
        }
      }
    }

    for (const file of files) {
      if (file && file.filename) {
        try {
          const filePath = file.path || path.join(uploadsDir, file.filename);
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            await persistFileToMongo(file.filename, buffer, {
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            });
          }
        } catch (innerErr) {
          console.error('persistUploadedFiles: failed to persist', file.filename, innerErr.message);
        }
      }
    }
  } catch (err) {
    console.error('persistUploadedFiles error:', err.message);
  }
  next();
}

module.exports = { upload, uploadsDir, persistFileToMongo, getFileFromMongo, persistUploadedFiles };
