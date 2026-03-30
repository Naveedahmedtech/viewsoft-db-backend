const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Resolve upload directory from env or default to project/uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

// 50mb max to mirror server.json limit
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { upload, uploadDir };
