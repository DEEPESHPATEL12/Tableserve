const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const paymentModel = require("../models/payment.model");
const orderModel = require("../models/order.model");

/**
 * Step 1 of the payment flow: customer has an unpaid order and wants to pay.
 * We create a Razorpay order (server-side, using our secret key) for the
 * EXACT amount stored on our own order record - never a value sent by the client.
 */
async function createPaymentOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "orderId is required" });

    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.customer_id !== req.user.id) {
      return res.status(403).json({ error: "This is not your order" });
    }
    if (order.payment_status === "paid") {
      return res.status(400).json({ error: "This order has already been paid for" });
    }

    // Razorpay expects amount in paise (smallest currency unit), not rupees
    const amountInPaise = Math.round(Number(order.total_amount) * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${order.id}`,
      notes: { internalOrderId: order.id },
    });

    await paymentModel.create({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.total_amount,
    });

    // Frontend needs the key_id (public) and razorpay order id to open the checkout widget.
    // The key_secret NEVER leaves the server.
    res.status(201).json({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Step 2: after the customer completes payment in the Razorpay widget, the
 * frontend gets back { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * and sends them here. We MUST verify the signature ourselves - trusting the
 * frontend's "payment succeeded" claim without this check would let anyone
 * mark any order as paid for free.
 */
async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    const payment = await paymentModel.findByRazorpayOrderId(razorpay_order_id);
    if (!payment) return res.status(404).json({ error: "No matching payment record found" });

    const order = await orderModel.findById(payment.order_id);
    if (!order || order.customer_id !== req.user.id) {
      return res.status(403).json({ error: "This payment does not belong to you" });
    }

    // The core check: Razorpay signs `${order_id}|${payment_id}` with our secret key.
    // We recompute that signature ourselves and compare. If it doesn't match byte-for-byte,
    // either the payment is fake or the data was tampered with in transit.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(razorpay_signature, "utf8")
    );

    if (!isValid) {
      await paymentModel.markFailed(razorpay_order_id);
      return res.status(400).json({ error: "Payment signature verification failed" });
    }

    await paymentModel.markPaid({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
    const updatedOrder = await orderModel.updatePaymentStatus(order.id, "paid");

    const io = req.app.get("io");
    if (io) io.to(`restaurant:${order.restaurant_id}`).emit("order:paid", { orderId: order.id });

    res.json({ message: "Payment verified successfully", order: updatedOrder });
  } catch (err) {
    next(err);
  }
}

async function getPaymentStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.customer_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Not authorized to view this payment" });
    }

    const payment = await paymentModel.findByOrderId(orderId);
    res.json({ payment, paymentStatus: order.payment_status });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPaymentOrder, verifyPayment, getPaymentStatus };
