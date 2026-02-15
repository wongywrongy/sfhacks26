const { Router } = require('express');
const { orgAuth } = require('../middleware/auth');
const { createBuilding, getBuildings, getBuildingsOverview, deleteBuilding } = require('../controllers/building-controller');

const router = Router();

router.use(orgAuth);

router.get('/', getBuildings);
router.get('/overview', getBuildingsOverview);
router.post('/', createBuilding);
router.delete('/:buildingId', deleteBuilding);

module.exports = router;
