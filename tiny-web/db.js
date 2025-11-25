// db.js (CommonJS)
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple health check
async function testDbConnection() {
  const res = await pool.query('SELECT NOW() AS now');
  return res.rows[0].now;
}

module.exports = {
  pool,
  testDbConnection,
};
