const { Router } = require('express');
const { orgAuth } = require('../middleware/auth');
const { createProject, getProject, getProjects, getMember, updateMemberOrgStatus, retryMemberChecks } = require('../controllers/project-controller');

const router = Router();

router.use(orgAuth);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:projectId', getProject);
router.get('/:projectId/members/:memberId', getMember);
router.put('/:projectId/members/:memberId/status', updateMemberOrgStatus);
router.post('/:projectId/members/:memberId/retry', retryMemberChecks);

module.exports = router;
