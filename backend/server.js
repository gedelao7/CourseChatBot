require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { OpenAI } = require('openai');
const dataProcessor = require('./utils/dataProcessor');
const courseDownloader = require('./utils/courseDownloader');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenAI with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const { message, format, maxLength } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Search for relevant content in the transcripts
    let relevantContent = '';
    try {
      const searchResults = await dataProcessor.searchTranscripts(message);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        // Extract relevant content from top 3 hits
        relevantContent = searchResults.hits.slice(0, 3).map(hit => {
          return `From ${hit.module || 'Unknown module'} - ${hit.title || 'Unknown document'}: ${hit.content.substring(0, 500)}...`;
        }).join('\n\n');
      }
    } catch (error) {
      console.log('Error searching transcripts (proceeding with general response):', error.message);
    }

    // Prepare system message based on whether we have relevant content
    let systemMessage;
    if (relevantContent) {
      systemMessage = `You are a helpful course assistant specifically for a Cardiopulmonary Practice course. 
      Provide informed answers based ONLY on the following course material. 
      Do not make up information that isn't in the provided context:
      
      ${relevantContent}`;
    } else {
      systemMessage = `You are a helpful assistant for a Cardiopulmonary Practice course. 
      Answer questions about cardiopulmonary topics accurately but indicate when you don't have 
      specific information from the course materials.`;
    }

    // Add formatting instructions if provided
    if (format) {
      systemMessage += `\n\nFormat your response as ${format}.`;
    }
    if (maxLength) {
      systemMessage += `\n\nLimit your response to approximately ${maxLength} sentences.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    res.json({ 
      response: completion.choices[0].message.content,
      sourceFound: !!relevantContent
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Route to trigger course materials download and processing
app.post('/api/process-course', async (req, res) => {
  try {
    // Start the processing in the background
    res.json({ message: 'Course processing started. This may take several minutes.' });
    
    // Process course materials (download, extract, index)
    const transcriptFiles = await courseDownloader.processCourseMaterials();
    console.log(`Found ${transcriptFiles.length} transcript files to process`);
    
    // Process each file for Algolia indexing
    let processedCount = 0;
    for (const file of transcriptFiles) {
      await dataProcessor.processTranscript(file.path, {
        module: file.module,
        title: file.filename,
        type: file.type
      });
      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${transcriptFiles.length} files`);
      }
    }
    
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
    try {
      const searchResults = await dataProcessor.searchTranscripts(topic);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        relevantContent = searchResults.hits.slice(0, 3).map(hit => hit.content.substring(0, 1000)).join('\n\n');
      }
    } catch (error) {
      console.log('Error searching transcripts:', error.message);
    }

    const systemMessage = `You are a flashcard generator for a Cardiopulmonary Practice course. 
    Generate ${count || 5} high-quality flashcards based on this topic: "${topic}".
    ${relevantContent ? 'Use the following content from course materials:' + relevantContent : ''}
    
    Format each flashcard as a JSON object with "front" and "back" properties.
    Return an array of these objects.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Generate ${count || 5} flashcards about "${topic}" from the course materials.` }
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
        error: 'Could not parse flashcards' 
      });
    }

    res.json({ 
      flashcards,
      sourceFound: !!relevantContent
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
    try {
      const searchResults = await dataProcessor.searchTranscripts(topic);
      if (searchResults && searchResults.hits && searchResults.hits.length > 0) {
        relevantContent = searchResults.hits.slice(0, 3).map(hit => hit.content.substring(0, 1000)).join('\n\n');
      }
    } catch (error) {
      console.log('Error searching transcripts:', error.message);
    }

    const systemMessage = `You are a quiz generator for a Cardiopulmonary Practice course. 
    Generate ${count || 5} multiple-choice questions at ${difficulty || 'medium'} difficulty level based on this topic: "${topic}".
    ${relevantContent ? 'Use the following content from course materials:' + relevantContent : ''}
    
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
        { role: "user", content: `Generate ${count || 5} ${difficulty || 'medium'} difficulty quiz questions about "${topic}" from the course materials.` }
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
        error: 'Could not parse quiz questions' 
      });
    }

    res.json({ 
      questions: quizQuestions,
      sourceFound: !!relevantContent
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Analytics endpoint to log user questions
app.post('/api/log-question', (req, res) => {
  const { question, wasHelpful } = req.body;
  
  // Here you would typically store this in a database
  console.log('Question logged:', { question, wasHelpful, timestamp: new Date() });
  
  res.status(200).json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('- /api/chat - Chat with the course assistant');
  console.log('- /api/process-course - Download and index course materials');
  console.log('- /api/generate-flashcards - Generate flashcards on a topic');
  console.log('- /api/generate-quiz - Generate quiz questions on a topic');
}); 