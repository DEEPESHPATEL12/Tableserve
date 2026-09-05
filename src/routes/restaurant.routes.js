const router = require("express").Router();
const controller = require("../controllers/restaurant.controller");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

// Public routes
router.get("/", controller.listPublic);
router.get("/:id", controller.getById);

// Restaurant admin routes (must come before "/:id" would shadow it, so declare specific paths first)
router.get("/mine/list", requireAuth, requireRole("restaurant_admin", "super_admin"), controller.myRestaurants);

router.post(
  "/",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  upload.single("logo"),
  controller.create
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  upload.single("logo"),
  controller.update
);

router.patch(
  "/:id/toggle-open",
  requireAuth,
  requireRole("restaurant_admin", "super_admin"),
  controller.toggleOpen
);

router.delete("/:id", requireAuth, requireRole("restaurant_admin", "super_admin"), controller.remove);

module.exports = router;
