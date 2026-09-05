const db = require("../config/db");

const VALID_STATUSES = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];

// Defines which status can move to which - prevents nonsensical jumps like delivered -> placed
const ALLOWED_TRANSITIONS = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * Creates an order + its line items atomically. `items` is an array of
 * { menuItem (full row from DB), quantity } - price is taken from the DB
 * row, NEVER from client input, so a tampered request can't get free food.
 */
async function createWithItems({ customerId, restaurantId, items, deliveryAddress, notes }) {
  return db.withTransaction(async (client) => {
    const totalAmount = items.reduce((sum, i) => sum + Number(i.menuItem.price) * i.quantity, 0);

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, restaurant_id, total_amount, delivery_address, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [customerId, restaurantId, totalAmount, deliveryAddress, notes]
    );
    const order = orderResult.rows[0];

    for (const { menuItem, quantity } of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order)
         VALUES ($1, $2, $3, $4)`,
        [order.id, menuItem.id, quantity, menuItem.price]
      );
    }

    return order;
  });
}

async function findById(id) {
  const { rows } = await db.query("SELECT * FROM orders WHERE id = $1", [id]);
  return rows[0] || null;
}

/** Full order detail including line items with menu item names (for receipts/order tracking) */
async function findByIdWithItems(id) {
  const order = await findById(id);
  if (!order) return null;

  const { rows: items } = await db.query(
    `SELECT oi.id, oi.quantity, oi.price_at_order, mi.name, mi.image_url
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = $1`,
    [id]
  );

  return { ...order, items };
}

async function findByCustomer(customerId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );
  return rows;
}

async function findByRestaurant(restaurantId, { status, limit = 50, offset = 0 } = {}) {
  const query = status
    ? `SELECT * FROM orders WHERE restaurant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
    : `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  const params = status ? [restaurantId, status, limit, offset] : [restaurantId, limit, offset];
  const { rows } = await db.query(query, params);
  return rows;
}

/** Validates the requested transition is legal before writing it (state machine enforcement) */
function canTransition(currentStatus, newStatus) {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

async function updateStatus(id, newStatus) {
  const { rows } = await db.query(
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [newStatus, id]
  );
  return rows[0] || null;
}

async function updatePaymentStatus(id, paymentStatus) {
  const { rows } = await db.query(
    `UPDATE orders SET payment_status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [paymentStatus, id]
  );
  return rows[0] || null;
}

module.exports = {
  VALID_STATUSES,
  createWithItems,
  findById,
  findByIdWithItems,
  findByCustomer,
  findByRestaurant,
  canTransition,
  updateStatus,
  updatePaymentStatus,
};
