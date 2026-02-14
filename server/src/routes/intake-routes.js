const { Router } = require('express');
const { handleIntake } = require('../controllers/intake-controller');

const router = Router();

// Public endpoint — no auth required
router.post('/:intakeToken', handleIntake);

module.exports = router;
