import { assertLocalSeedEnvironment, seedDevelopmentData, seedScenarios, validateSeedOptions, type SeedScenario } from './developmentSeed';

async function main() {
  assertLocalSeedEnvironment(process.env);
  const args = process.argv.slice(2);
  const positional: string[] = [];
  let scenario = 'core';
  let date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === '--scenario') scenario = args[++index] || '';
    else if (value === '--date') date = args[++index] || '';
    else if (value.startsWith('--')) throw new Error('Unknown seed option; use --scenario and --date');
    else positional.push(value);
  }
  if (positional.length > 2) throw new Error('Usage: bun run seed [email] [password] [--scenario core|vat|identified|all] [--date YYYY-MM-DD]');
  const options = {
    email: positional[0] || 'test@example.invalid', password: positional[1] || process.env.SEED_PASSWORD || 'password123', date,
    scenarios: scenario === 'all' ? [...seedScenarios] : [scenario as SeedScenario],
  };
  validateSeedOptions(options);
  // Load DB only after local safeguards and CLI validation. Never start the server/jobs.
  const { pool } = await import('./init');
  try {
    const users = await seedDevelopmentData(pool, options);
    console.log(`Seed complete (${date}); synthetic data only.`);
    for (const user of users) console.log(`  ${user.scenario}: ${user.email}`);
  } finally {
    await pool.end();
  }
}
main().catch(error => {
  // PostgreSQL details can include password hashes and row contents; do not print them.
  console.error(`Seed failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
