const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const { convertFile } = require('../services/conversion');
const {
  ALLOWED_EXTENSIONS,
  ALLOWED_FORMATS,
  MAX_FILE_SIZE,
  assignJobId,
  upload
} = require('../services/upload');

const router = express.Router();

let db = null;

function setDatabase(database) {
  db = database;
}

const UPLOAD_HINT = `Allowed types: ${ALLOWED_EXTENSIONS.join(', ')} (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`;

router.use((req, res, next) => {
  res.locals.user = null;
  next();
});

/**
 * Loads the signed-in user for a page request. Unlike the API's requireAuth,
 * an anonymous visitor is sent to the login page rather than given a 401.
 */
async function requireUser(req, res, next) {
  if (!db) {
    return res.status(500).render('error', {
      title: 'Server error',
      message: 'Database not initialized.'
    });
  }

  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const user = await db.findUserById(req.session.userId);
    if (!user) {
      return req.session.destroy(() => res.redirect('/login'));
    }
    req.user = { id: user.id, username: user.username, email: user.email };
    res.locals.user = req.user;
    next();
  } catch (error) {
    console.error('UI auth error:', error);
    res.status(500).render('error', {
      title: 'Server error',
      message: 'Something went wrong. Please try again.'
    });
  }
}

// Runs multer without letting an upload error bubble out as an HTML stack trace
function runUpload(req, res) {
  return new Promise((resolve) => {
    upload.single('file')(req, res, (err) => resolve(err || null));
  });
}

async function discardUpload(file) {
  if (!file) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.error('Failed to discard upload:', error);
  }
}

router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Log in', error: null, username: '' });
});

router.post('/login', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const reject = (message) =>
    res.status(401).render('login', { title: 'Log in', error: message, username });

  try {
    if (!username || !password) {
      return res.status(400).render('login', {
        title: 'Log in',
        error: 'Username and password are required.',
        username
      });
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
      return reject('Invalid credentials.');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return reject('Invalid credentials.');
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('UI login error:', error);
    res.status(500).render('login', {
      title: 'Log in',
      error: 'Something went wrong. Please try again.',
      username
    });
  }
});

router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('register', { title: 'Create an account', error: null, username: '', email: '' });
});

router.post('/register', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const reject = (status, message) =>
    res.status(status).render('register', {
      title: 'Create an account',
      error: message,
      username,
      email
    });

  try {
    if (!username || !email || !password) {
      return reject(400, 'All fields are required.');
    }

    if (await db.findUserByUsername(username)) {
      return reject(409, 'That username is already taken.');
    }

    if (await db.findUserByEmail(email)) {
      return reject(409, 'That email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser(username, email, passwordHash);

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('UI registration error:', error);
    reject(500, 'Something went wrong. Please try again.');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/dashboard', requireUser, async (req, res) => {
  try {
    const jobs = await db.findJobsByUserId(req.user.id);
    res.render('dashboard', {
      title: 'My conversions',
      jobs,
      formats: ALLOWED_FORMATS,
      uploadHint: UPLOAD_HINT,
      error: null
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Server error',
      message: 'Could not load your conversions.'
    });
  }
});

router.post('/convert', requireUser, assignJobId, async (req, res) => {
  const renderError = async (status, message) => {
    await discardUpload(req.file);
    let jobs = [];
    try {
      jobs = await db.findJobsByUserId(req.user.id);
    } catch (error) {
      console.error('Dashboard reload error:', error);
    }
    return res.status(status).render('dashboard', {
      title: 'My conversions',
      jobs,
      formats: ALLOWED_FORMATS,
      uploadHint: UPLOAD_HINT,
      error: message
    });
  };

  const uploadError = await runUpload(req, res);
  if (uploadError) {
    return renderError(400, uploadError.message);
  }

  try {
    if (!req.file) {
      return renderError(400, 'Choose a file to convert.');
    }

    const targetFormat =
      typeof req.body.targetFormat === 'string' ? req.body.targetFormat.toLowerCase() : '';

    if (!ALLOWED_FORMATS.includes(targetFormat)) {
      return renderError(400, `Invalid target format. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`);
    }

    const inputExt = path.extname(req.file.originalname).toLowerCase().slice(1);
    if (inputExt === targetFormat) {
      return renderError(400, 'Target format must be different from the input format.');
    }

    const jobId = req.uploadJobId;
    const inputPath = req.file.path;
    const outputPath = path.join(path.dirname(inputPath), `${jobId}.${targetFormat}`);

    await db.createJob(
      jobId,
      req.user.id,
      inputPath,
      outputPath,
      targetFormat,
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

    res.redirect(`/jobs/${jobId}`);
  } catch (error) {
    console.error('UI convert error:', error);
    return renderError(500, 'Could not start the conversion. Please try again.');
  }
});

router.get('/jobs/:jobId', requireUser, async (req, res) => {
  try {
    const job = await db.findJobByJobId(req.params.jobId);

    if (!job) {
      return res.status(404).render('error', {
        title: 'Job not found',
        message: 'No conversion job with that ID.'
      });
    }

    res.render('job', { title: `Job ${job.jobId}`, job });
  } catch (error) {
    console.error('UI job page error:', error);
    res.status(500).render('error', {
      title: 'Server error',
      message: 'Could not load that conversion.'
    });
  }
});

router.get('/jobs/:jobId/download', requireUser, async (req, res) => {
  try {
    const job = await db.findJobByJobId(req.params.jobId);

    if (!job) {
      return res.status(404).render('error', {
        title: 'Job not found',
        message: 'No conversion job with that ID.'
      });
    }

    if (job.status !== 'completed' || !job.outputPath) {
      return res.status(400).render('error', {
        title: 'Not ready',
        message: 'That conversion has not finished yet.'
      });
    }

    try {
      await fs.access(job.outputPath);
    } catch {
      return res.status(404).render('error', {
        title: 'File missing',
        message: 'The converted file is no longer available.'
      });
    }

    const filename = path.basename(job.outputPath);
    res.download(job.outputPath, filename, (err) => {
      if (err) {
        console.error('UI download error:', err);
      }
    });
  } catch (error) {
    console.error('UI download route error:', error);
    res.status(500).render('error', {
      title: 'Server error',
      message: 'Could not download that file.'
    });
  }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
