const express = require('express');
const { searchPolicyByUsername } = require('../controllers/searchController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: 'Too many search requests, please try again later.'
});

router.get('/policies/search', searchLimiter, searchPolicyByUsername);

module.exports = router;