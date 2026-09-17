const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '..', '..', 'data', 'files');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const STORAGE_QUOTA = 100 * 1024 * 1024; // 100 MB per account

// Every account keeps its files in its own area under the storage root, so one
// account's uploads never mix with another's.
function userDirectory(req) {
  return path.join(STORAGE_ROOT, req.user.username);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const userDir = userDirectory(req);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename(req, file, cb) {
    // The browser controls the name of the part it sends, so keep the last
    // segment only: a name like "../../etc/passwd" becomes "passwd" and cannot
    // walk out of the upload directory.
    const safeName = path.basename(file.originalname || '');
    cb(null, safeName || `upload-${Date.now()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 }
}).single('file');

function listFiles(userDir) {
  if (!fs.existsSync(userDir)) {
    return [];
  }
  return fs.readdirSync(userDir)
    .map((name) => {
      const stats = fs.statSync(path.join(userDir, name));
      if (!stats.isFile()) {
        return null;
      }
      return {
        name,
        size: stats.size,
        uploadedAt: stats.mtime.toISOString()
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// GET /api/files — the caller's own files, plus how much of the quota they use
router.get('/', (req, res) => {
  try {
    const files = listFiles(userDirectory(req));
    const usedBytes = files.reduce((total, file) => total + file.size, 0);
    res.json({ files, usage: { usedBytes, quotaBytes: STORAGE_QUOTA } });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// POST /api/files — upload one file into the caller's area
router.post('/', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is larger than the 10 MB limit' });
      }
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        name: req.file.filename,
        size: req.file.size,
        uploadedAt: new Date().toISOString()
      }
    });
  });
});

// GET /api/files/:filename/download — stream one of the caller's files back
router.get('/:filename/download', (req, res) => {
  try {
    // Strip any directory part the client tried to send, so the name can only
    // ever point at a file directly inside the caller's own directory.
    const filename = path.basename(req.params.filename);
    if (!filename || filename === '.' || filename === '..') {
      return res.status(400).json({ error: 'Filename required' });
    }

    const filePath = path.join(userDirectory(req), filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Stored files are served as opaque downloads: the browser is told not to
    // sniff the type and not to render it, so an uploaded .html or .svg cannot
    // execute script on this origin.
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, filename);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE /api/files/:filename — remove one of the caller's files
router.delete('/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!filename || filename === '.' || filename === '..') {
      return res.status(400).json({ error: 'Filename required' });
    }

    const filePath = path.join(userDirectory(req), filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted', filename });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
