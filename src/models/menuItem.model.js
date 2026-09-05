const db = require("../config/db");

async function create({ restaurantId, name, description, price, imageUrl, category }) {
  const { rows } = await db.query(
    `INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [restaurantId, name, description, price, imageUrl, category || "General"]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query("SELECT * FROM menu_items WHERE id = $1", [id]);
  return rows[0] || null;
}

/** Public: full menu for a restaurant, grouped implicitly by category via ORDER BY */
async function findByRestaurant(restaurantId, { onlyAvailable = false } = {}) {
  const query = onlyAvailable
    ? `SELECT * FROM menu_items WHERE restaurant_id = $1 AND is_available = TRUE ORDER BY category, name`
    : `SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name`;
  const { rows } = await db.query(query, [restaurantId]);
  return rows;
}

async function update(id, fields) {
  const allowed = ["name", "description", "price", "image_url", "category", "is_available"];
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
    `UPDATE menu_items SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query("DELETE FROM menu_items WHERE id = $1", [id]);
}

/** Fetches multiple menu items at once by id list - used when validating an order's cart */
async function findByIds(ids) {
  if (ids.length === 0) return [];
  const { rows } = await db.query("SELECT * FROM menu_items WHERE id = ANY($1::uuid[])", [ids]);
  return rows;
}

module.exports = { create, findById, findByRestaurant, update, remove, findByIds };
