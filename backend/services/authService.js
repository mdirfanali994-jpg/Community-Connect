const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'community-connect-auth-secret-key-2026-v1';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Revoked token set for invalidated sessions (e.g. after explicit logout)
const revokedTokens = new Set();

/**
 * Creates a cryptographically signed session token.
 * Payload includes user ID, role, community ID, expiration timestamp, and unique jti.
 */
function createSession(user) {
  const userId = user.id || user._id?.toString() || user.workerId;
  const payload = {
    id: String(userId),
    role: user.role,
    communityId: user.communityId ? String(user.communityId) : null,
    workerId: user.workerId ? String(user.workerId) : null,
    jti: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + SESSION_EXPIRY_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const token = `${payloadB64}.${signature}`;
  return { token, expiresAt: payload.exp };
}

/**
 * Verifies a session token signature, expiration, and revocation status.
 * Returns decoded payload if valid, or null if invalid/expired/revoked.
 */
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;

  if (revokedTokens.has(token)) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Recompute signature and verify using constant-time comparison
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (signature.length !== expectedSig.length) return null;
  try {
    const sigValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
    if (!sigValid) return null;
  } catch (_) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Revokes a session token so it cannot be used again.
 */
function revokeSession(token) {
  if (token && typeof token === 'string') {
    revokedTokens.add(token);
    // Periodically prune tokens if set grows large
    if (revokedTokens.size > 10000) {
      revokedTokens.clear();
    }
    return true;
  }
  return false;
}

module.exports = {
  createSession,
  verifySession,
  revokeSession,
};
