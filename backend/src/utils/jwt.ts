/**
 * Get the JWT signing secret from the environment.
 * Throws if JWT_SECRET is missing or too short to be safe.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'JWT_SECRET must be set to a random value of at least 16 characters. Generate one with: openssl rand -hex 32'
    );
  }
  return secret;
}

/**
 * Validate that JWT_SECRET is properly configured.
 * Call at startup to fail fast.
 */
export function validateJwtSecret(): void {
  getJwtSecret();
}
