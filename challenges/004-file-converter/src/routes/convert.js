const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');
const { convertFile } = require('../services/conversion');
const { ALLOWED_FORMATS, assignJobId, upload } = require('../services/upload');

const router = express.Router();

let db = null;

function setDatabase(database) {
  db = database;
}

// POST /convert - Submit a file conversion job
router.post('/convert', requireAuth, assignJobId, upload.single('file'), async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { targetFormat } = req.body;

    if (!targetFormat || !ALLOWED_FORMATS.includes(targetFormat.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid target format. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`
      });
    }

    const inputExt = path.extname(req.file.originalname).toLowerCase().slice(1);

    if (inputExt === targetFormat.toLowerCase()) {
      return res.status(400).json({ error: 'Target format must be different from input format' });
    }

    const jobId = req.uploadJobId;
    const inputPath = req.file.path;
    const outputExt = targetFormat.toLowerCase();
    const outputPath = path.join(
      path.dirname(inputPath),
      `${jobId}.${outputExt}`
    );

    await db.createJob(
      jobId,
      req.user.id,
      inputPath,
      outputPath,
      targetFormat.toLowerCase(),
      req.file.originalname
    );

    setImmediate(async () => {
      try {
        await db.updateJobStatus(jobId, 'processing');

        await convertFile(inputPath, outputPath);

        await db.updateJobStatus(jobId, 'completed', outputPath);
      } catch (error) {
        console.error(`Conversion error for job ${jobId}:`, error);
        await db.updateJobStatus(jobId, 'failed');
      }
    });

    res.status(202).json({
      message: 'Conversion job submitted',
      jobId: jobId
    });
  } catch (error) {
    console.error('Convert route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /convert/:jobId - Get conversion job status
router.get('/convert/:jobId', requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { jobId } = req.params;
    const job = await db.findJobByJobId(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response = {
      jobId: job.jobId,
      status: job.status,
      targetFormat: job.targetFormat,
      createdAt: job.createdAt
    };

    if (job.status === 'completed' && job.outputPath) {
      response.outputUrl = `/api/convert/${jobId}/download`;
    }

    res.json(response);
  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /convert/:jobId/download - Download converted file
router.get('/convert/:jobId/download', requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { jobId } = req.params;
    const job = await db.findJobByJobId(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed' || !job.outputPath) {
      return res.status(400).json({ error: 'File not ready for download' });
    }

    try {
      await fs.access(job.outputPath);
    } catch {
      return res.status(404).json({ error: 'Output file not found' });
    }

    const filename = path.basename(job.outputPath);
    res.download(job.outputPath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('Download route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
