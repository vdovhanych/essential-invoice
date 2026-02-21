import { query } from '../db/init';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: bun run delete-user <email>');
    process.exit(1);
  }

  try {
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('\nUser found:');
    console.log(`  Name:    ${user.name}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Created: ${user.created_at}`);
    console.log(`  ID:      ${user.id}`);
    console.log('\nThis will permanently delete the user and ALL associated data (invoices, clients, expenses, payments, settings).');

    process.stdout.write('\nAre you sure? (y/N): ');

    const response = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (response !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }

    await query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log(`\nUser ${user.email} and all associated data have been deleted.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
