const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class DatabaseStore {
  constructor() {
    this.client = null;
    this.db = null;
    this.usersCollection = null;
    this.jobsCollection = null;
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fileconverter';
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db('fileconverter');
      this.usersCollection = this.db.collection('users');
      this.jobsCollection = this.db.collection('jobs');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB connection closed');
    }
  }

  // User operations
  async createUser(username, email, passwordHash) {
    try {
      const user = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        createdAt: new Date()
      };
      const result = await this.usersCollection.insertOne(user);
      return {
        id: result.insertedId.toString(),
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  async findUserByUsername(username) {
    try {
      const user = await this.usersCollection.findOne({ username: username.trim() });
      if (!user) return null;
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt
      };
    } catch (error) {
      throw error;
    }
  }

  async findUserByEmail(email) {
    try {
      const user = await this.usersCollection.findOne({ email: email.trim().toLowerCase() });
      if (!user) return null;
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt
      };
    } catch (error) {
      throw error;
    }
  }

  async findUserById(userId) {
    try {
      const user = await this.usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) return null;
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Returns the next job ID for today. Uses an atomic counter per date.
   */
  async getNextJobId() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const dateDigits = dateStr.replace(/-/g, '');
    const counters = this.db.collection('counters');
    const result = await counters.findOneAndUpdate(
      { _id: `job_${dateStr}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    return `${dateDigits}${result.seq}`;
  }

  // Job operations
  async createJob(jobId, userId, inputPath, outputPath, targetFormat, originalFilename) {
    try {
      const job = {
        jobId,
        userId: new ObjectId(userId),
        status: 'pending',
        inputPath,
        outputPath,
        targetFormat,
        originalFilename,
        createdAt: new Date()
      };
      await this.jobsCollection.insertOne(job);
      return job;
    } catch (error) {
      throw error;
    }
  }

  async findJobByJobId(jobId) {
    try {
      const job = await this.jobsCollection.findOne({ jobId });
      if (!job) return null;
      return {
        jobId: job.jobId,
        userId: job.userId.toString(),
        status: job.status,
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        targetFormat: job.targetFormat,
        originalFilename: job.originalFilename,
        createdAt: job.createdAt
      };
    } catch (error) {
      throw error;
    }
  }

  async findJobsByUserId(userId) {
    try {
      const jobs = await this.jobsCollection
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      return jobs.map((job) => ({
        jobId: job.jobId,
        userId: job.userId.toString(),
        status: job.status,
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        targetFormat: job.targetFormat,
        originalFilename: job.originalFilename,
        createdAt: job.createdAt
      }));
    } catch (error) {
      throw error;
    }
  }

  async updateJobStatus(jobId, status, outputPath = null) {
    try {
      const update = { status };
      if (outputPath) {
        update.outputPath = outputPath;
      }
      await this.jobsCollection.updateOne(
        { jobId },
        { $set: update }
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = DatabaseStore;
