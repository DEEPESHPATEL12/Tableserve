const router = require("express").Router();
const controller = require("../controllers/payment.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.post("/create-order", requireAuth, requireRole("customer"), controller.createPaymentOrder);
router.post("/verify", requireAuth, requireRole("customer"), controller.verifyPayment);
router.get("/status/:orderId", requireAuth, controller.getPaymentStatus);

module.exports = router;
