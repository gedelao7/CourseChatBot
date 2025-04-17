const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { OpenAI } = require('openai');
const dataProcessor = require('../utils/dataProcessor');

const app = express();

// Initialize OpenAI with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) return callback(null, true);
    
    // List of allowed origins for iframe embedding
    const allowedOrigins = [
      'http://localhost:3000',
      'https://chatbot75.netlify.app',
      'https://*.netlify.app',
      'https://*.instructure.com',
      'https://*.canvas.net',
      'https://*.canvaslms.com',
      'https://dev-learninglibrary.com'
    ];
    
    // Check if the origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        // Handle wildcard domains
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`Origin ${origin} not allowed by CORS`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Algolia if credentials are provided
if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
  dataProcessor.initAlgolia(
    process.env.ALGOLIA_APP_ID,
    process.env.ALGOLIA_API_KEY,
    process.env.ALGOLIA_INDEX_NAME || 'course_transcripts'
  );
}

// Mount API routes
app.use('/api', require('../routes/api'));

// Export the serverless handler
module.exports.handler = serverless(app); 