const router = require("express").Router();
const controller = require("../controllers/menuItem.controller");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

// Public: customer-facing menu for a restaurant
router.get("/restaurant/:restaurantId", controller.listByRestaurant);

// Restaurant admin: full menu including unavailable items
router.get(
  "/restaurant/:restaurantId/admin",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  controller.listByRestaurantAdmin
);

router.post(
  "/",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  upload.single("image"),
  controller.create
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  upload.single("image"),
  controller.update
);

router.patch(
  "/:id/toggle-availability",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  controller.toggleAvailability
);

router.delete("/:id", requireAuth, requireRole("restaurant_admin", "super_admin"), controller.remove);

module.exports = router;
