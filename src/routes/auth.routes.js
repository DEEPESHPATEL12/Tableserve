const router = require("express").Router();
// Full implementation added in Phase 2
router.get("/_placeholder", (req, res) => res.json({ message: "auth routes coming in Phase 2" }));
module.exports = router;
