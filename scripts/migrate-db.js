const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/notepad_db',
});

// Migration tracking table
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  try {
    // Ensure migrations table exists
    await pool.query(MIGRATIONS_TABLE);
    
    // Get migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('📁 Created migrations directory');
    }
    
    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (migrationFiles.length === 0) {
      console.log('✅ No migrations to run');
      return;
    }
    
    // Get already applied migrations
    const appliedResult = await pool.query('SELECT filename FROM migrations');
    const appliedMigrations = appliedResult.rows.map(row => row.filename);
    
    // Run pending migrations
    let migrationsRun = 0;
    
    for (const filename of migrationFiles) {
      if (appliedMigrations.includes(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }
      
      console.log(`🔧 Applying migration: ${filename}`);
      
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Run migration in transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${filename}`);
        migrationsRun++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to apply migration ${filename}: ${error.message}`);
      } finally {
        client.release();
      }
    }
    
    if (migrationsRun > 0) {
      console.log(`\n🎉 Successfully applied ${migrationsRun} migration(s)`);
    } else {
      console.log('✅ Database is up to date');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Create sample migration if none exist
async function createSampleMigration() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  const sampleMigrationPath = path.join(migrationsDir, '001_initial_schema.sql');
  
  if (!fs.existsSync(sampleMigrationPath)) {
    const sampleMigration = `-- Initial schema migration
-- This migration creates the basic tables for the notepad application

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;
    
    fs.writeFileSync(sampleMigrationPath, sampleMigration);
    console.log('📝 Created sample migration: 001_initial_schema.sql');
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'run':
      await runMigrations();
      break;
    case 'create':
      await createSampleMigration();
      break;
    default:
      console.log('Usage:');
      console.log('  node migrate-db.js run    - Run pending migrations');
      console.log('  node migrate-db.js create - Create sample migration');
      break;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { runMigrations, createSampleMigration }; 