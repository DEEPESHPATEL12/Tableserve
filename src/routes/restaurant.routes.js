const router = require("express").Router();
router.get("/_placeholder", (req, res) => res.json({ message: "restaurant routes coming in Phase 3" }));
module.exports = router;
