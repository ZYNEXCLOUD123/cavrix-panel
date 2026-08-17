import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, pool } from '../src/database/pool.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  try {
    const username = await prompt('Username: ');
    const email = await prompt('Email: ');
    const password = await prompt('Password: ');

    if (!username || !email || !password) {
      console.error('All fields are required.');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('Password must be at least 8 characters.');
      process.exit(1);
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1 OR username = $2`, [email, username]);
    if (existing.rows.length > 0) {
      console.error('Email or username already exists.');
      process.exit(1);
    }

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO users (id, username, email, password_hash, is_admin, status) VALUES ($1, $2, $3, $4, true, 'active')`,
      [id, username, email, hash]
    );

    // Assign OWNER role
    const { rows: ownerRole } = await query<{ id: string }>(
      `SELECT id FROM roles WHERE name = 'OWNER' LIMIT 1`
    );
    if (ownerRole.length > 0) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
        id,
        ownerRole[0].id,
      ]);
    }

    console.log(`\nAdmin user created: ${username} (${email})`);
  } catch (error: any) {
    console.error('Failed:', error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
