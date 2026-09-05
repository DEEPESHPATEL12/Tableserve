const multer = require("multer");

// Store in memory (not disk) since we immediately stream to Cloudinary
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = upload;
