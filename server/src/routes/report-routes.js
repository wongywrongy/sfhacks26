const { Router } = require('express');
const { getApplicantReportPublic } = require('../controllers/analytics-controller');

// Mounted at /api/reports — public, no auth
const router = Router();

router.get('/:reportToken', getApplicantReportPublic);

module.exports = router;
