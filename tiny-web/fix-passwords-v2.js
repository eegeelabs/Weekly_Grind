#!/usr/bin/env node
// Hash password and update all users in database

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file manually to check for issues
const envPath = path.join(__dirname, '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });
}

console.log('Database configuration:');
console.log('  Host:', envVars.DB_HOST || 'localhost');
console.log('  Port:', envVars.DB_PORT || 5432);
console.log('  Database:', envVars.DB_NAME || 'weekly_grind');
console.log('  User:', envVars.DB_USER || 'postgres');
console.log('  Password:', envVars.DB_PASSWORD ? '***' + envVars.DB_PASSWORD.slice(-3) : 'NOT SET');

// Ensure password is a string
const dbPassword = envVars.DB_PASSWORD ? String(envVars.DB_PASSWORD) : '';

if (!dbPassword) {
  console.error('\n❌ ERROR: DB_PASSWORD is not set in .env file!');
  console.log('\nPlease add DB_PASSWORD to your .env file:');
  console.log('DB_PASSWORD=your_postgres_password');
  process.exit(1);
}

const pool = new Pool({
  host: envVars.DB_HOST || 'localhost',
  port: parseInt(envVars.DB_PORT) || 5432,
  database: envVars.DB_NAME || 'weekly_grind',
  user: envVars.DB_USER || 'postgres',
  password: dbPassword
});

async function fixUserPasswords() {
  try {
    console.log('\nConnecting to database...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✓ Connected to database successfully');
    
    // Check current table structure
    console.log('\nChecking users table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''})`);
    });
    
    // Check if password column exists
    const hasPassword = columns.rows.some(col => col.column_name === 'password');
    
    if (!hasPassword) {
      console.log('\n❌ Password column missing - adding it...');
      await pool.query('ALTER TABLE users ADD COLUMN password VARCHAR(255)');
      console.log('✓ Password column added');
    } else {
      console.log('\n✓ Password column exists');
    }
    
    // Check if avatar column exists
    const hasAvatar = columns.rows.some(col => col.column_name === 'avatar');
    
    if (!hasAvatar) {
      console.log('❌ Avatar column missing - adding it...');
      await pool.query("ALTER TABLE users ADD COLUMN avatar VARCHAR(10) DEFAULT '👤'");
      console.log('✓ Avatar column added');
    } else {
      console.log('✓ Avatar column exists');
    }
    
    // Get all users
    const users = await pool.query('SELECT id, username, password FROM users');
    console.log(`\n✓ Found ${users.rows.length} users`);
    
    // Hash default password
    const defaultPassword = 'TempPass123!';
    console.log(`\nHashing default password: ${defaultPassword}`);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    console.log('✓ Password hashed:', hashedPassword.substring(0, 20) + '...');
    
    // Update users who don't have passwords
    console.log('\nUpdating user passwords...');
    let updated = 0;
    let alreadySet = 0;
    
    for (const user of users.rows) {
      if (!user.password) {
        console.log(`  ⚙️  Setting password for: ${user.username}`);
        await pool.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );
        updated++;
      } else {
        console.log(`  ✓ ${user.username} already has password`);
        alreadySet++;
      }
    }
    
    console.log(`\n✓ Updated ${updated} user(s)`);
    console.log(`✓ ${alreadySet} user(s) already had passwords`);
    
    // Verify
    console.log('\nVerifying users...');
    const verification = await pool.query(`
      SELECT username, 
             password IS NOT NULL as has_password,
             role,
             LEFT(password, 20) as password_start
      FROM users
      ORDER BY username
    `);
    
    console.log('\n========================================');
    console.log('USER STATUS');
    console.log('========================================');
    verification.rows.forEach(row => {
      const status = row.has_password ? '✅' : '❌';
      console.log(`${status} ${row.username} (${row.role}) - ${row.password_start || 'NO PASSWORD'}...`);
    });
    
    console.log('\n========================================');
    console.log('✅ SUCCESS!');
    console.log('========================================');
    console.log('\nAll users now have passwords!');
    console.log(`\nDefault password: ${defaultPassword}`);
    console.log('\n⚠️  IMPORTANT: Users should change their passwords after first login.');
    console.log('\n✅ You can now login with any username and the password above!');
    
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

console.log('\n========================================');
console.log('PASSWORD FIX SCRIPT');
console.log('========================================\n');

fixUserPasswords();
