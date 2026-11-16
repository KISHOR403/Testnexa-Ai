const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const intelligenceController = require('../controllers/intelligence.controller');

const router = express.Router();

router.use(protect);

router.get('/overview', intelligenceController.getOverview);
router.get('/activity', intelligenceController.getActivity);

module.exports = router;
