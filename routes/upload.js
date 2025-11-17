const express = require('express');
const upload = require('../middleware/upload');
const { uploadFile } = require('../controllers/uploadController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 uploads per windowMs
  message: 'Too many file upload attempts, please try again later.'
});

router.post('/upload', uploadLimiter, upload.single('file'), uploadFile);

module.exports = router;