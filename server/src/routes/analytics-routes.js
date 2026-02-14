const { Router } = require('express');
const { orgAuth } = require('../middleware/auth');
const {
  getAnalytics,
  getContributions,
  updateCustomModel,
  createReport,
  getReport,
} = require('../controllers/analytics-controller');

// Mounted at /api/projects/:projectId — mergeParams so we get projectId
const router = Router({ mergeParams: true });

router.use(orgAuth);

router.get('/analytics', getAnalytics);
router.get('/contributions', getContributions);
router.put('/contributions/custom', updateCustomModel);
router.post('/report', createReport);
router.get('/report', getReport);

module.exports = router;
