require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { OpenAI } = require('openai');
const dataProcessor = require('./utils/dataProcessor');
const courseDownloader = require('./utils/courseDownloader');
const fs = require('fs');
const checkPort = require('./checkPort');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenAI with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) return callback(null, true);
    
    // List of allowed origins for iframe embedding
    const allowedOrigins = [
      'http://localhost:3000',
      'https://chatbot75.netlify.app',
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
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin.includes('localhost:3000')) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://chatbot75.netlify.app');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Only set these headers if not in development
  if (process.env.NODE_ENV !== 'development') {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://chatbot75.netlify.app');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://chatbot75.netlify.app https://*.instructure.com https://*.canvas.net https://*.canvaslms.com https://dev-learninglibrary.com");
  }
  
  next();
});

// Initialize Algolia if credentials are provided
if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
  dataProcessor.initAlgolia(
    process.env.ALGOLIA_APP_ID,
    process.env.ALGOLIA_API_KEY,
    process.env.ALGOLIA_INDEX_NAME || 'course_transcripts'
  );
}

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, format, maxLength, isLectureReference } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Log the question for analytics
    logQuestion(message, true);
    
    // Search for relevant content in the transcripts
    let relevantContent = '';
    let sourceFound = false;
    let relevanceScore = 0;
    let topMatches = [];
    
    try {
      // If this is a lecture reference, refine the search
      let searchParams = {};
      
      if (isLectureReference) {
        console.log('Detected lecture reference question');
        const lectureMatch = message.match(/lecture\s+(\d+|[a-z]+)/i);
        if (lectureMatch && lectureMatch[1]) {
          const lectureNum = lectureMatch[1];
          // Custom filter for lecture references - we'll pass this to searchTranscripts
          searchParams = {
            filters: `title:*lecture*${lectureNum}* OR module:*lecture*${lectureNum}*`
          };
          console.log(`Searching for lecture reference: ${lectureNum}`);
        }
      }
      
      const searchResults = await dataProcessor.searchTranscripts(message, searchParams);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        // Extract relevant content from top results
        topMatches = searchResults.hits.slice(0, 5).map(hit => {
          return {
            title: hit.title || 'Unknown document',
            module: hit.module || 'Unknown module',
            score: hit.score || 0
          };
        });
        
        relevantContent = searchResults.hits.slice(0, 5).map(hit => {
          // Add the score to calculate total relevance
          relevanceScore += hit.score || 0;
          return `From ${hit.module || 'Unknown module'} - ${hit.title || 'Unknown document'}: ${hit.content.substring(0, 800)}...`;
        }).join('\n\n');
        sourceFound = true;
      }
    } catch (error) {
      console.log('Error searching transcripts:', error.message);
    }

    // Count of available transcripts
    const transcriptCount = dataProcessor.getTranscriptsCount();
    
    if (transcriptCount === 0) {
      return res.json({
        response: "I don't have any course materials loaded yet. Please load the course materials first so I can provide accurate responses based on your specific course content.",
        sourceFound: false,
        transcriptsAvailable: false
      });
    }

    // More nuanced off-topic detection
    const isLowRelevance = !sourceFound || relevanceScore < 3;
    let suggestedTopics = [];
    
    if (isLowRelevance) {
      // Try to detect course-related terminology to suggest related topics
      try {
        // Get most frequent topics from available transcripts
        const courseTopicResults = await dataProcessor.getFrequentTopics(5);
        suggestedTopics = courseTopicResults.topics || [];
      } catch (error) {
        console.error('Error getting suggested topics:', error);
      }
      
      const suggestionsText = suggestedTopics.length > 0 
        ? `You might want to ask about: ${suggestedTopics.join(', ')}.` 
        : 'Try asking about specific lectures, concepts, or topics covered in the course.';
        
      return res.json({
        response: `I can only answer questions related to the course materials. This question appears to be outside the scope of the course content I have access to. ${suggestionsText}`,
        sourceFound: false,
        transcriptsAvailable: true,
        offtopic: true,
        suggestedTopics: suggestedTopics
      });
    }

    // Prepare system message with strong guardrails
    const systemMessage = `You are a course assistant specifically for a Cardiopulmonary Practice course.
    You must ONLY provide answers based on the following course material excerpts.
    DO NOT make up information or rely on external knowledge.
    If the provided excerpts don't contain sufficient information to answer the question fully, acknowledge the limitations clearly.
    Stay focused on the specific content in these excerpts, even if you know other information on the topic.
    
    Here are the relevant course materials:
    ${relevantContent}
    
    If asked about specific lecture numbers or sections, identify which module and lecture you're drawing information from.
    Cite the specific lecture or document when possible.${isLectureReference ? '\n\nThis question is specifically about a lecture, so make sure to mention which lecture(s) you are referencing in your answer.' : ''}`;

    // Add formatting instructions if provided
    let finalSystemMessage = systemMessage;
    if (format) {
      finalSystemMessage += `\n\nFormat your response as ${format}.`;
    }
    if (maxLength) {
      finalSystemMessage += `\n\nLimit your response to approximately ${maxLength} sentences.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: finalSystemMessage },
        { role: "user", content: message }
      ],
      max_tokens: 800,
      temperature: 0.5
    });

    res.json({ 
      response: completion.choices[0].message.content,
      sourceFound: true,
      transcriptsAvailable: true,
      topMatches: topMatches,
      isLectureReference: isLectureReference
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Route to trigger course materials processing from local folder
app.post('/api/process-course', async (req, res) => {
  try {
    const courseDir = path.join(__dirname, 'data/course');
    
    // Check if the directory exists
    if (!fs.existsSync(courseDir)) {
      return res.status(404).json({ 
        error: 'Course directory not found. Please place your transcript files in the backend/data/course directory.'
      });
    }
    
    // Start the processing in the background
    res.json({ message: 'Course processing started. This may take several minutes.' });
    
    // Process each file for indexing
    console.log('Processing course materials from local directory...');
    const results = await dataProcessor.processTranscriptDirectory(courseDir);
    console.log(`Processed ${results.length} files successfully`);
    
    console.log('Course processing completed!');
  } catch (error) {
    console.error('Error processing course:', error);
  }
});

// Route to generate flashcards
app.post('/api/generate-flashcards', async (req, res) => {
  try {
    const { topic, count } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Find relevant content for the topic
    let relevantContent = '';
    let sourceFound = false;
    
    try {
      const searchResults = await dataProcessor.searchTranscripts(topic);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        // Only consider it source found if the relevance score is significant
        const totalScore = searchResults.hits.reduce((sum, hit) => sum + (hit.score || 0), 0);
        sourceFound = totalScore >= 10; // Set a minimum threshold for relevance
        
        if (sourceFound) {
          relevantContent = searchResults.hits.slice(0, 3).map(hit => hit.content.substring(0, 1000)).join('\n\n');
        }
      }
    } catch (error) {
      console.log('Error searching transcripts:', error.message);
    }

    // Check if we found relevant content in the transcripts
    if (!sourceFound) {
      return res.json({ 
        flashcards: [], 
        sourceFound: false,
        message: 'No relevant information found in course materials' 
      });
    }

    const systemMessage = `You are a flashcard generator for a Cardiopulmonary Practice course. 
    Generate ${count || 5} high-quality flashcards based on this topic: "${topic}".
    Use ONLY the following content from course materials:
    
    ${relevantContent}
    
    DO NOT make up information that isn't in the provided context.
    If the provided context doesn't cover the topic adequately, make fewer flashcards or focus on what IS available.
    Format each flashcard as a JSON object with "front" and "back" properties.
    Return an array of these objects.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Generate ${count || 5} flashcards about "${topic}" from the provided course materials.` }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    // Parse the response to extract the flashcards
    const responseText = completion.choices[0].message.content;
    let flashcards = [];
    
    try {
      // Extract JSON array from the response text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        flashcards = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON array found in response');
      }
    } catch (error) {
      console.error('Error parsing flashcards:', error);
      // Fallback: return the raw response
      return res.json({ 
        flashcards: [], 
        rawResponse: responseText,
        sourceFound: sourceFound,
        error: 'Could not parse flashcards' 
      });
    }

    res.json({ 
      flashcards,
      sourceFound: sourceFound
    });
  } catch (error) {
    console.error('Error generating flashcards:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Route to generate quiz questions
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { topic, count, difficulty } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Find relevant content for the topic
    let relevantContent = '';
    let sourceFound = false;
    
    try {
      const searchResults = await dataProcessor.searchTranscripts(topic);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        // Only consider it source found if the relevance score is significant
        const totalScore = searchResults.hits.reduce((sum, hit) => sum + (hit.score || 0), 0);
        sourceFound = totalScore >= 10; // Set a minimum threshold for relevance
        
        if (sourceFound) {
          relevantContent = searchResults.hits.slice(0, 3).map(hit => hit.content.substring(0, 1000)).join('\n\n');
        }
      }
    } catch (error) {
      console.log('Error searching transcripts:', error.message);
    }

    // Check if we found relevant content in the transcripts
    if (!sourceFound) {
      return res.json({ 
        questions: [], 
        sourceFound: false,
        message: 'No relevant information found in course materials' 
      });
    }

    const systemMessage = `You are a quiz generator for a Cardiopulmonary Practice course. 
    Generate ${count || 5} multiple-choice questions at ${difficulty || 'medium'} difficulty level based on this topic: "${topic}".
    Use ONLY the following content from course materials:
    
    ${relevantContent}
    
    DO NOT make up information that isn't in the provided context.
    If the provided context doesn't cover the topic adequately, make fewer questions or focus on what IS available.
    
    Format each question as a JSON object with:
    - "question": the question text
    - "options": array of possible answers
    - "answer": the index of the correct answer (0-based)
    - "explanation": brief explanation of the correct answer
    
    Return an array of these objects.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Generate ${count || 5} ${difficulty || 'medium'} difficulty quiz questions about "${topic}" from the provided course materials.` }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    // Parse the response to extract the quiz questions
    const responseText = completion.choices[0].message.content;
    let quizQuestions = [];
    
    try {
      // Extract JSON array from the response text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        quizQuestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON array found in response');
      }
    } catch (error) {
      console.error('Error parsing quiz questions:', error);
      // Fallback: return the raw response
      return res.json({ 
        questions: [], 
        rawResponse: responseText,
        sourceFound: sourceFound,
        error: 'Could not parse quiz questions' 
      });
    }

    res.json({ 
      questions: quizQuestions,
      sourceFound: sourceFound
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Add route for finding external resources
app.post('/api/find-external-resources', async (req, res) => {
  try {
    const { topic, count = 3, resourceType = { websites: true, videos: true } } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    console.log(`[API] Finding external resources for topic: ${topic}`);
    
    // Check if we have any transcripts processed
    const transcriptsAvailable = dataProcessor.getTranscriptsCount() > 0;
    console.log(`[API] Transcripts available: ${transcriptsAvailable ? 'Yes' : 'No'}, Count: ${dataProcessor.getTranscriptsCount()}`);
    
    if (!transcriptsAvailable) {
      return res.status(200).json({ 
        links: [],
        sourceFound: false,
        transcriptsAvailable: false,
        message: 'No course transcripts available. Please process course materials first.'
      });
    }
    
    // Find relevant external resources
    try {
      const result = await dataProcessor.findExternalResources(topic, resourceType, count);
      console.log(`[API] Resource search complete. Found ${result.links?.length || 0} links`);
      
      return res.json({
        ...result,
        transcriptsAvailable: true
      });
    } catch (resourceError) {
      console.error('[API] Error in findExternalResources function:', resourceError);
      return res.status(500).json({ 
        error: 'Error finding external resources',
        message: resourceError.message,
        transcriptsAvailable: true
      });
    }
  } catch (error) {
    console.error('[API] Uncaught error in find-external-resources route:', error);
    return res.status(500).json({ 
      error: 'Server error processing external resource request',
      message: error.message
    });
  }
});

// Analytics endpoint to log user questions
function logQuestion(question, wasHelpful) {
  // Here you would typically store this in a database
  console.log('Question logged:', { question, wasHelpful, timestamp: new Date() });
}

// API endpoint to get stats about available transcripts
app.get('/api/transcript-stats', (req, res) => {
  res.json({
    count: dataProcessor.getTranscriptsCount(),
    algoliaConnected: !!process.env.ALGOLIA_APP_ID && !!process.env.ALGOLIA_API_KEY
  });
});

// Start the server
async function startServer() {
  try {
    const portAvailable = await checkPort(PORT);
    if (!portAvailable) {
      console.error(`Port ${PORT} is already in use. Please make sure no other instance is running.`);
      process.exit(1);
    }

    let configValid = validateConfig();
    
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      
      if (!configValid) {
        console.log('\nWarning: Some configuration is missing or invalid.');
        console.log('The server will still run, but some features may be limited.\n');
      }
      
      console.log('Available endpoints:');
      console.log('- /api/chat - Send messages to the chatbot');
      console.log('- /api/process-course - Process course materials');
      console.log('- /api/generate-flashcards - Generate flashcards');
      console.log('- /api/generate-quiz - Generate quiz questions');
      console.log('- /api/find-external-resources - Find relevant external resources');
      console.log('- /api/transcript-stats - Get stats about available transcripts');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Validate configuration
function validateConfig() {
  const requiredEnvVars = ['OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('⚠️ Missing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables in your .env file');
    return false;
  }
  
  // Check if OPENAI_API_KEY has been masked or modified
  const apiKeyPattern = /^(sk-|OPENAI-|fake)/;
  if (!apiKeyPattern.test(process.env.OPENAI_API_KEY)) {
    console.error('⚠️ OPENAI_API_KEY appears to be invalid');
    return false;
  }
  
  // Warn about optional environment variables
  const optionalEnvVars = ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY', 'ALGOLIA_INDEX_NAME'];
  const missingOptionalVars = optionalEnvVars.filter(varName => !process.env[varName]);
  
  if (missingOptionalVars.length > 0) {
    console.warn('⚠️ Missing optional environment variables:', missingOptionalVars.join(', '));
    console.warn('Algolia search will not be available.');
  }
  
  return true;
}

function gracefulShutdown(server) {
  console.log('Received kill signal, shutting down gracefully');
  server.close(() => {
    console.log('Closed out remaining connections');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
}); 