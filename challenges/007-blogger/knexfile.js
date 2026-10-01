require('dotenv').config();

const url = process.env.DATABASE_URL || (() => {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.POSTGRES_USER || 'blogger_user';
  const password = process.env.POSTGRES_PASSWORD ;
  const database = process.env.POSTGRES_DB || 'blogger_db';
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
})();

module.exports = {
  development: {
    client: 'pg',
    connection: url,
    migrations: {
      directory: './db/migrations'
    },
    pool: { min: 1, max: 5 }
  },
  production: {
    client: 'pg',
    connection: url,
    migrations: {
      directory: './db/migrations'
    },
    pool: { min: 1, max: 10 }
  }
};
