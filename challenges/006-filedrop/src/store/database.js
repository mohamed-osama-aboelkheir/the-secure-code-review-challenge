const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class DatabaseStore {
  constructor() {
    this.client = null;
    this.db = null;
    this.usersCollection = null;
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/filedrop';
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db('filedrop');
      this.usersCollection = this.db.collection('users');
      await this.usersCollection.createIndex({ username: 1 }, { unique: true });
      await this.usersCollection.createIndex({ email: 1 }, { unique: true });
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

  toPublicUser(user) {
    if (!user) return null;
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

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
    const user = await this.usersCollection.findOne({ username: username.trim() });
    return this.toPublicUser(user);
  }

  async findUserByEmail(email) {
    const user = await this.usersCollection.findOne({ email: email.trim().toLowerCase() });
    return this.toPublicUser(user);
  }

  async findUserById(userId) {
    if (!ObjectId.isValid(userId)) {
      return null;
    }
    const user = await this.usersCollection.findOne({ _id: new ObjectId(userId) });
    return this.toPublicUser(user);
  }

  async countUsers() {
    return this.usersCollection.countDocuments();
  }
}

module.exports = DatabaseStore;
