const db = require("../config/db");
const { hashToken } = require("../utils/jwt");

async function store(userId, refreshToken, expiresAt) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
}

/** Returns true if this exact refresh token is valid and not revoked */
async function isValid(userId, refreshToken) {
  const { rows } = await db.query(
    `SELECT id FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > now()`,
    [userId, hashToken(refreshToken)]
  );
  return rows.length > 0;
}

async function revoke(userId, refreshToken) {
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND token_hash = $2`,
    [userId, hashToken(refreshToken)]
  );
}

/** Revokes ALL sessions for a user - useful for "log out everywhere" or security events */
async function revokeAllForUser(userId) {
  await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [userId]);
}

module.exports = { store, isValid, revoke, revokeAllForUser };
