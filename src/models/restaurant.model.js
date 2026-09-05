const db = require("../config/db");

async function create({ ownerId, name, description, address, phone, logoUrl }) {
  const { rows } = await db.query(
    `INSERT INTO restaurants (owner_id, name, description, address, phone, logo_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ownerId, name, description, address, phone, logoUrl]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query("SELECT * FROM restaurants WHERE id = $1", [id]);
  return rows[0] || null;
}

async function findByOwner(ownerId) {
  const { rows } = await db.query(
    "SELECT * FROM restaurants WHERE owner_id = $1 ORDER BY created_at DESC",
    [ownerId]
  );
  return rows;
}

/** Public listing - all open restaurants, newest first, with pagination */
async function listOpen({ limit = 20, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM restaurants WHERE is_open = TRUE
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function update(id, fields) {
  // Build a dynamic SET clause from whichever fields were provided
  const allowed = ["name", "description", "address", "phone", "logo_url", "is_open"];
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }
  if (sets.length === 0) return findById(id);

  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await db.query(
    `UPDATE restaurants SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query("DELETE FROM restaurants WHERE id = $1", [id]);
}

/** Used by menu/order routes to verify the requester actually owns this restaurant */
async function isOwnedBy(restaurantId, userId) {
  const { rows } = await db.query(
    "SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2",
    [restaurantId, userId]
  );
  return rows.length > 0;
}

module.exports = { create, findById, findByOwner, listOpen, update, remove, isOwnedBy };
