import { runMigrations, rollbackLastMigration } from './migrations.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const command = process.argv[2];

async function main() {
  try {
    if (command === 'rollback') {
      await rollbackLastMigration();
    } else {
      await runMigrations();
    }
    process.exit(0);
  } catch (error) {
    console.error('[CAVRIX] Migration failed:', error);
    process.exit(1);
  }
}

main();
