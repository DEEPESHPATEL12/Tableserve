const router = require("express").Router();
router.get("/_placeholder", (req, res) => res.json({ message: "payment routes coming in Phase 6" }));
module.exports = router;
