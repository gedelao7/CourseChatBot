const express = require('express');
const router = express.Router();
const dataProcessor = require('../utils/dataProcessor');

// Get transcript stats
router.get('/transcript-stats', (req, res) => {
  res.json({
    count: dataProcessor.getTranscriptsCount(),
    algoliaConnected: !!process.env.ALGOLIA_APP_ID && !!process.env.ALGOLIA_API_KEY
  });
});

// Chat endpoint
router.post('/chat', async (req, res) => {
  // ... existing chat endpoint code ...
});

// Process course endpoint
router.post('/process-course', async (req, res) => {
  // ... existing process-course endpoint code ...
});

// Generate flashcards endpoint
router.post('/generate-flashcards', async (req, res) => {
  // ... existing generate-flashcards endpoint code ...
});

// Generate quiz endpoint
router.post('/generate-quiz', async (req, res) => {
  // ... existing generate-quiz endpoint code ...
});

// Find external resources endpoint
router.post('/find-external-resources', async (req, res) => {
  // ... existing find-external-resources endpoint code ...
});

module.exports = router; 