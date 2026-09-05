const router = require("express").Router();
const controller = require("../controllers/order.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

// Customer routes
router.post("/", requireAuth, requireRole("customer"), controller.placeOrder);
router.get("/mine", requireAuth, requireRole("customer"), controller.myOrders);
router.patch("/:id/cancel", requireAuth, requireRole("customer"), controller.cancelOrder);

// Restaurant admin routes
router.get(
  "/restaurant/:restaurantId",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  controller.restaurantOrders
);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  controller.updateStatus
);

// Shared: anyone with access to this specific order (customer, restaurant owner, or super admin)
router.get("/:id", requireAuth, controller.getOrder);

module.exports = router;
