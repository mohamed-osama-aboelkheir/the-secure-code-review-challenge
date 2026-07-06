const bcrypt = require('bcrypt');
const DatabaseStore = require('../src/store/database');
require('dotenv').config();

// Function to generate a random password
function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function createAdminUser() {
  const db = new DatabaseStore();
  
  try {
    await db.init();
    console.log('Database initialized successfully');
    
    // Check if admin user already exists
    const existingAdmin = await db.findUserByUsername('admin');
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }
    
    // Generate random password
    const randomPassword = generateRandomPassword();
    
    // Create admin user
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(randomPassword, saltRounds);
    
    const adminUser = await db.createUser(
      'admin',
      'admin@teached.com',
      passwordHash,
      'admin'
    );
    
    console.log('Admin user created successfully:');
    console.log('Username: admin');
    console.log('Password: ' + randomPassword);
    console.log('Email: admin@teached.com');
    console.log('Role: admin');
    console.log('\n⚠️  IMPORTANT: Save this password securely! It will not be shown again.');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await db.close();
  }
}

createAdminUser();
