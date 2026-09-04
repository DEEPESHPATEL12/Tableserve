const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Generates a short-lived access token carrying user id + role.
 * This is what gets sent as "Authorization: Bearer <token>" on every request.
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m" }
  );
}

/**
 * Generates a long-lived refresh token. We only put the user id in it —
 * the actual validity is checked against the refresh_tokens table (hashed),
 * so a token can be revoked server-side even before it naturally expires.
 */
function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * We never store raw refresh tokens in the DB — only a SHA-256 hash.
 * This way, even if the database leaks, tokens can't be replayed directly.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
