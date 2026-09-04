const db = require("../config/db");

/** Fields safe to send back to the client (never expose password_hash) */
const PUBLIC_FIELDS = "id, name, email, role, avatar_url, is_active, created_at";

async function findByEmail(email) {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] || null;
}

async function findByGoogleId(googleId) {
  const { rows } = await db.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function createWithPassword({ name, email, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING ${PUBLIC_FIELDS}`,
    [name, email, passwordHash]
  );
  return rows[0];
}

async function createWithGoogle({ name, email, googleId, avatarUrl }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, google_id, avatar_url, role)
     VALUES ($1, $2, $3, $4, 'customer')
     RETURNING ${PUBLIC_FIELDS}`,
    [name, email, googleId, avatarUrl]
  );
  return rows[0];
}

/** Links a Google account to an existing email/password account (same email) */
async function linkGoogleId(userId, googleId) {
  const { rows } = await db.query(
    `UPDATE users SET google_id = $1, updated_at = now() WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
    [googleId, userId]
  );
  return rows[0];
}

module.exports = {
  findByEmail,
  findByGoogleId,
  findById,
  createWithPassword,
  createWithGoogle,
  linkGoogleId,
  PUBLIC_FIELDS,
};
