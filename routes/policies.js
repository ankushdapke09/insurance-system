const express = require('express');
const { getAggregatedPoliciesByUser } = require('../controllers/policyController');

const router = express.Router();

router.get('/policies/aggregated', getAggregatedPoliciesByUser);

module.exports = router;