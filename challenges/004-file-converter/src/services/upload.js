const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Shared upload handling for both the JSON API and the web UI, so that both
 * entry points accept the same file types, size limit, and storage naming.
 */

const ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.md'];
const ALLOWED_FORMATS = ['docx', 'pdf', 'md'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

let db = null;

function setDatabase(database) {
  db = database;
}

// Extension = last '.' and following characters
function extensionOf(originalname) {
  const lastDot = originalname.lastIndexOf('.');
  return (lastDot >= 0 ? originalname.slice(lastDot) : '').toLowerCase();
}

// Assign next job ID before multer
async function assignJobId(req, res, next) {
  if (!db) return res.status(500).json({ error: 'Database not initialized' });
  try {
    req.uploadJobId = await db.getNextJobId();
    next();
  } catch (err) {
    console.error('assignJobId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const jobId = req.uploadJobId;
    cb(null, `${jobId}${extensionOf(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    console.log('File:', file.originalname);
    const ext = extensionOf(file.originalname);
    console.log('Extension:', ext);

    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_FORMATS,
  MAX_FILE_SIZE,
  assignJobId,
  setDatabase,
  upload
};
