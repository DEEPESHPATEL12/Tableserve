const router = require("express").Router();
const passport = require("passport");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const googleAuthController = require("../controllers/googleAuth.controller");

// ---- Email/password ----
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

// ---- Google OAuth ----
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/api/auth/google/failure" }),
  googleAuthController.googleCallback
);

router.get("/google/failure", (req, res) => {
  res.status(401).json({ error: "Google authentication failed" });
});

module.exports = router;
