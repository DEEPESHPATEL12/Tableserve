const db = require("../config/db");

async function create({ orderId, razorpayOrderId, amount }) {
  const { rows } = await db.query(
    `INSERT INTO payments (order_id, razorpay_order_id, amount, status)
     VALUES ($1, $2, $3, 'created')
     RETURNING *`,
    [orderId, razorpayOrderId, amount]
  );
  return rows[0];
}

async function findByOrderId(orderId) {
  const { rows } = await db.query(
    "SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
    [orderId]
  );
  return rows[0] || null;
}

async function findByRazorpayOrderId(razorpayOrderId) {
  const { rows } = await db.query("SELECT * FROM payments WHERE razorpay_order_id = $1", [razorpayOrderId]);
  return rows[0] || null;
}

async function markPaid({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const { rows } = await db.query(
    `UPDATE payments
     SET status = 'paid', razorpay_payment_id = $1, razorpay_signature = $2
     WHERE razorpay_order_id = $3
     RETURNING *`,
    [razorpayPaymentId, razorpaySignature, razorpayOrderId]
  );
  return rows[0] || null;
}

async function markFailed(razorpayOrderId) {
  const { rows } = await db.query(
    `UPDATE payments SET status = 'failed' WHERE razorpay_order_id = $1 RETURNING *`,
    [razorpayOrderId]
  );
  return rows[0] || null;
}

module.exports = { create, findByOrderId, findByRazorpayOrderId, markPaid, markFailed };
