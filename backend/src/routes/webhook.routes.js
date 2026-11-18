/**
 * Testnexa AI — Webhook Ingress Routes
 * Public webhook ingress for GitHub App events
 * Authenticated via HMAC-SHA256 signature
 */

const express = require('express');
const { handleGitHubWebhook } = require('../controllers/cicd.controller');

const router = express.Router();

// GitHub App Webhook Ingress
router.post('/github', handleGitHubWebhook);

module.exports = router;
