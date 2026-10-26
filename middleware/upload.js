const fs = require('fs');
const path = require('path');
const multer = require('multer');

const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'private_uploads');

// Ensure base upload directories exist
const DIRS = [
  BASE_UPLOAD_DIR,
  path.join(BASE_UPLOAD_DIR, 'evidence'),
  path.join(BASE_UPLOAD_DIR, 'profiles'),
  path.join(BASE_UPLOAD_DIR, 'chat'),
  path.join(BASE_UPLOAD_DIR, 'reports'),
  path.join(BASE_UPLOAD_DIR, 'annotated')
];

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Storage for crime-scene evidence images
const evidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(BASE_UPLOAD_DIR, 'evidence'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `evid_${uniqueSuffix}${sanitizedExt}`);
  }
});

// Storage for profile photographs
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(BASE_UPLOAD_DIR, 'profiles'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `profile_${uniqueSuffix}${sanitizedExt}`);
  }
});

// Storage for chat message attachments
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(BASE_UPLOAD_DIR, 'chat'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `attach_${uniqueSuffix}${sanitizedExt}`);
  }
});

// File filter for images (Evidence & Profile)
const imageFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Security Rejection: Invalid image format '${ext}'. Only JPG, JPEG, PNG, and WebP are permitted.`));
  }
};

// File filter for chat attachments (Images + PDF + Docs)
const chatFileFilter = (req, file, cb) => {
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.com', '.vbs', '.js', '.jar', '.msi'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (dangerousExtensions.includes(ext)) {
    return cb(new Error(`Security Rejection: Dangerous executable file type '${ext}' is prohibited.`));
  }

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.doc', '.docx'];
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${ext}' is not supported for secure document transfer.`));
  }
};

const uploadEvidence = multer({
  storage: evidenceStorage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB per file
    files: 10 // Max 10 files per upload batch
  },
  fileFilter: imageFileFilter
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

const uploadAttachment = multer({
  storage: chatStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  },
  fileFilter: chatFileFilter
});

module.exports = {
  BASE_UPLOAD_DIR,
  uploadEvidence,
  uploadProfile,
  uploadAttachment
};
