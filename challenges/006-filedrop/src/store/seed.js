const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Two accounts with a little content each, so the app is usable the moment it
// boots. Runs once: if the users are already there, nothing is touched.
const DEMO_ACCOUNTS = [
  {
    username: 'demo',
    email: 'demo@filedrop.local',
    passwordEnv: 'SEED_DEMO_PASSWORD',
    defaultPassword: 'demo12345',
    files: {
      'welcome.txt': 'Welcome to FileDrop!\n\nDrop a file on the dashboard to upload it.\n',
      'notes.md': '# Scratch notes\n\n- try the drag-and-drop upload\n- files are private to your account\n'
    }
  },
  {
    username: 'casey',
    email: 'casey@filedrop.local',
    passwordEnv: 'SEED_CASEY_PASSWORD',
    defaultPassword: 'casey12345',
    files: {
      'q3-forecast.csv': 'quarter,revenue,margin\nQ1,184000,0.31\nQ2,203500,0.34\nQ3,241900,0.36\n',
      'private-keys-backup.txt': 'reminder: rotate the staging API token before the audit\n'
    }
  }
];

async function seedDemoData(db, storageRoot) {
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.findUserByUsername(account.username);
    if (existing) {
      continue;
    }

    const password = process.env[account.passwordEnv] || account.defaultPassword;
    const passwordHash = await bcrypt.hash(password, 10);
    await db.createUser(account.username, account.email, passwordHash);

    const userDir = path.join(storageRoot, account.username);
    fs.mkdirSync(userDir, { recursive: true });
    for (const [name, contents] of Object.entries(account.files)) {
      fs.writeFileSync(path.join(userDir, name), contents);
    }
    console.log(`Seeded account: ${account.username}`);
  }
}

module.exports = seedDemoData;
