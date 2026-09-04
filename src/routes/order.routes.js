const router = require("express").Router();
router.get("/_placeholder", (req, res) => res.json({ message: "order routes coming in Phase 4" }));
module.exports = router;
