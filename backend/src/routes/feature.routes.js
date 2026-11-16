const express = require('express');
const { getAllFeatures, getFeatureInfo } = require('../middleware/featureFlag.middleware');

const router = express.Router();

// GET /api/v1/features - Expose current runtime feature flags
router.get('/', (req, res) => {
    const features = getAllFeatures();
    res.json({
        success: true,
        features,
        data: features,
        ...features
    });
});

// GET /api/v1/features/:featureName
router.get('/:featureName', (req, res) => {
    const info = getFeatureInfo(req.params.featureName);
    res.json({
        success: true,
        feature: info,
        data: info
    });
});

module.exports = router;
