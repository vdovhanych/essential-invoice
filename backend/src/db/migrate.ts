import { initializeDatabase, pool } from './init';

async function migrate() {
  try {
    console.log('Running database migrations...');
    await initializeDatabase();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
