const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
};

const dbName = process.env.PGDATABASE || 'notepad_db';

async function setupDatabase() {
  console.log('🚀 Setting up Notepad database...\n');
  
  // First, connect to default database to create our database
  const client = new Client({
    ...dbConfig,
    database: 'postgres' // Connect to default postgres database
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Check if database exists
    const dbCheckResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (dbCheckResult.rows.length === 0) {
      // Create database
      console.log(`📦 Creating database: ${dbName}`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } else {
      console.log(`✅ Database '${dbName}' already exists`);
    }

    await client.end();

    // Now connect to our specific database and run schema
    const appClient = new Client({
      ...dbConfig,
      database: dbName
    });

    await appClient.connect();
    console.log(`✅ Connected to ${dbName} database`);

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, '..', 'db.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Running database schema...');
    await appClient.query(schema);
    console.log('✅ Database schema applied successfully');

    // Verify tables were created
    const tablesResult = await appClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log('\n📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    await appClient.end();
    console.log('\n🎉 Database setup completed successfully!');
    console.log(`\n💡 You can now start the application with: npm start`);
    console.log(`🔗 Database URL: postgresql://${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbName}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Please check your PostgreSQL credentials:');
      console.error('   - PGUSER (default: postgres)');
      console.error('   - PGPASSWORD');
      console.error('   - PGHOST (default: localhost)');
      console.error('   - PGPORT (default: 5432)');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Please ensure PostgreSQL is running.');
      console.error('   - macOS: brew services start postgresql');
      console.error('   - Ubuntu: sudo service postgresql start');
      console.error('   - Windows: Start PostgreSQL service');
    }
    
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase; 