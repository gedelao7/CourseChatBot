const fs = require('fs');
const path = require('path');
const algoliasearch = require('algoliasearch');
const axios = require('axios');
const { OpenAI } = require('openai');

// Configure Algolia client
let algoliaClient = null;
let algoliaIndex = null;

// Initialize OpenAI with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Local transcript storage
let localTranscripts = [];
let isInitialized = false;

// Initialize Algolia with your credentials
function initAlgolia(appId, apiKey, indexName) {
  try {
    algoliaClient = algoliasearch(appId, apiKey);
    algoliaIndex = algoliaClient.initIndex(indexName);
    console.log('Algolia initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Algolia:', error);
    return false;
  }
}

// Process and index a transcript file
async function processTranscript(filePath, moduleInfo) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic metadata extraction (can be enhanced based on file format)
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath);
    
    // Create a document to be indexed
    const document = {
      objectID: `transcript_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      fileName,
      filePath,
      content,
      module: moduleInfo.module || 'Unknown',
      title: moduleInfo.title || fileName.replace(fileExt, ''),
      type: 'transcript',
      createdAt: new Date().toISOString()
    };
    
    // Store locally always
    localTranscripts.push(document);
    isInitialized = true;
    
    // If Algolia is initialized, index the document
    if (algoliaIndex) {
      try {
        await algoliaIndex.saveObject(document);
        console.log(`Indexed transcript in Algolia: ${fileName}`);
      } catch (error) {
        console.error(`Error indexing in Algolia: ${error.message}`);
      }
    }
    
    console.log(`Processed transcript: ${fileName}`);
    return document;
  } catch (error) {
    console.error(`Error processing transcript ${filePath}:`, error);
    return null;
  }
}

// Process an entire directory of transcripts
async function processTranscriptDirectory(dirPath, moduleInfo = {}) {
  try {
    const files = fs.readdirSync(dirPath);
    const results = [];
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Recursively process subdirectories
        const subdirResults = await processTranscriptDirectory(fullPath, {
          ...moduleInfo,
          module: moduleInfo.module || file
        });
        results.push(...subdirResults);
      } else if (stats.isFile()) {
        // Process files with transcript extensions (.txt, .vtt, etc.)
        const ext = path.extname(file).toLowerCase();
        if (['.txt', '.vtt', '.srt', '.doc', '.docx', '.pdf'].includes(ext)) {
          const result = await processTranscript(fullPath, moduleInfo);
          if (result) results.push(result);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
    return [];
  }
}

// Search for relevant content
async function searchTranscripts(query, options = {}) {
  // First try Algolia if available
  if (algoliaIndex) {
    try {
      const searchResults = await algoliaIndex.search(query, options);
      return searchResults;
    } catch (error) {
      console.error('Error searching in Algolia:', error);
      // Fall back to local search
    }
  }
  
  // Local search if Algolia not available or failed
  if (!isInitialized || localTranscripts.length === 0) {
    throw new Error('No transcripts have been processed yet');
  }
  
  console.log(`Searching local transcripts for: "${query}"`);
  
  // More advanced keyword-based search with stemming and noise word removal
  // Remove common words that don't add search value
  const noiseWords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
                     'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 
                     'through', 'over', 'before', 'between', 'after', 'since', 'without', 
                     'under', 'within', 'along', 'following', 'across', 'behind', 
                     'beyond', 'plus', 'except', 'but', 'up', 'out', 'around', 'down', 
                     'off', 'above', 'near', 'i', 'you', 'he', 'she', 'we', 'they',
                     'what', 'which', 'who', 'whom', 'whose', 'why', 'where', 'when',
                     'how', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could',
                     'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'of'];
  
  // Extract and clean keywords from the query
  const cleanQuery = query.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 1 && !noiseWords.includes(word)); // Remove noise words and single characters
  
  // If no meaningful search terms, return empty results
  if (cleanQuery.length === 0) {
    return {
      hits: [],
      nbHits: 0,
      query
    };
  }
  
  console.log(`Searching for keywords: ${cleanQuery.join(', ')}`);
  
  // Create regex patterns for each keyword for more precise matching
  const keywordPatterns = cleanQuery.map(keyword => new RegExp(`\\b${keyword}\\w*\\b`, 'gi'));
  
  // Score documents based on keyword matches with more sophisticated scoring
  const scoredDocs = localTranscripts.map(doc => {
    const content = doc.content.toLowerCase();
    const title = doc.title ? doc.title.toLowerCase() : '';
    const module = doc.module ? doc.module.toLowerCase() : '';
    
    // Calculate score based on various factors
    let score = 0;
    let matchDetails = [];
    
    // Check for keyword matches
    keywordPatterns.forEach((pattern, idx) => {
      const keyword = cleanQuery[idx];
      
      // Title matches (weighted heavily)
      const titleMatches = (title.match(pattern) || []).length;
      if (titleMatches > 0) {
        score += titleMatches * 10;
        matchDetails.push(`Title match: ${keyword} (${titleMatches}×)`);
      }
      
      // Module matches (weighted moderately)
      const moduleMatches = (module.match(pattern) || []).length;
      if (moduleMatches > 0) {
        score += moduleMatches * 5;
        matchDetails.push(`Module match: ${keyword} (${moduleMatches}×)`);
      }
      
      // Content matches (based on frequency)
      const contentMatches = (content.match(pattern) || []).length;
      if (contentMatches > 0) {
        // Higher score for multiple matches
        score += Math.min(contentMatches, 20); // Cap at 20 to prevent bias toward very long documents
        matchDetails.push(`Content match: ${keyword} (${contentMatches}×)`);
        
        // Bonus for consecutive keywords appearing close together (phrase matching)
        if (idx > 0 && content.includes(`${cleanQuery[idx-1]} ${keyword}`)) {
          score += 5;
          matchDetails.push(`Phrase bonus: "${cleanQuery[idx-1]} ${keyword}"`);
        }
      }
    });
    
    // Bonus score if all keywords are found
    const allKeywordsFound = cleanQuery.every(keyword => 
      content.includes(keyword) || title.includes(keyword) || module.includes(keyword)
    );
    
    if (allKeywordsFound) {
      score += 15;
      matchDetails.push('All keywords found bonus');
    }
    
    // Include document details and debugging info
    return { 
      ...doc, 
      score,
      matchDetails 
    };
  });
  
  // Filter to only documents with matches, sort by score, and limit results
  const results = scoredDocs
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);  // Return top 7 results
  
  console.log(`Found ${results.length} matching documents. Top score: ${results.length > 0 ? results[0].score : 0}`);
  
  return {
    hits: results,
    nbHits: results.length,
    query
  };
}

// Load transcripts that already exist in the data directory
async function loadExistingTranscripts() {
  const dataDir = path.join(__dirname, '../data/course');
  
  if (fs.existsSync(dataDir)) {
    console.log('Loading existing transcripts from data directory...');
    await processTranscriptDirectory(dataDir);
    console.log(`Loaded ${localTranscripts.length} transcripts from disk`);
  }
}

// Call this on server startup
loadExistingTranscripts();

// Add function to find external resources based on topic
async function findExternalResources(topic, resourceType = { websites: true, videos: true }, count = 3) {
  console.log(`Finding external resources for topic: "${topic}" with types:`, resourceType);
  
  // First, check if the topic is found in our transcripts
  let topicFoundInTranscripts = false;
  try {
    const relevantContent = await searchTranscripts(topic);
    console.log(`Search results for "${topic}":`, {
      hitCount: relevantContent?.hits?.length || 0,
      firstHitScore: relevantContent?.hits?.[0]?.score || 0
    });
    
    if (relevantContent && relevantContent.hits && relevantContent.hits.length > 0) {
      topicFoundInTranscripts = true;
    }
    
    if (!topicFoundInTranscripts) {
      console.log(`Topic "${topic}" not found in transcripts`);
      return { links: [], sourceFound: false };
    }

    // Format what types of resources we want
    let resourceTypeText = '';
    if (resourceType.websites && resourceType.videos) {
      resourceTypeText = 'educational websites and YouTube videos';
    } else if (resourceType.websites) {
      resourceTypeText = 'educational websites';
    } else if (resourceType.videos) {
      resourceTypeText = 'YouTube videos';
    }
    console.log(`Requesting ${resourceTypeText} for "${topic}"`);

    // Construct a prompt for the AI
    const prompt = `I'm looking for ${count} reliable ${resourceTypeText} about "${topic}" in the context of cardiopulmonary physiology education. 
    The content in our course materials mentions this topic: ${relevantContent.hits[0]?.content?.substring(0, 300) || topic}
    
    Return the results as a valid JSON array with this exact structure (no markdown, ONLY valid JSON):
    [
      {
        "title": "Resource title",
        "url": "https://full-url-to-resource",
        "type": "website or youtube",
        "description": "A brief 1-2 sentence description of the resource and why it's relevant"
      }
    ]`;

    // Get completions from OpenAI using the globally initialized instance
    console.log(`Sending request to OpenAI for "${topic}" resources`);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });
    console.log('OpenAI response received');

    // Parse the result and extract links
    const response = completion.choices[0].message.content.trim();
    console.log(`OpenAI response length: ${response.length} characters`);
    
    try {
      // Find JSON array in the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const links = JSON.parse(jsonStr);
      console.log(`Successfully parsed ${links.length} links from OpenAI response`);
      
      // Validate and clean the links
      const validatedLinks = links.map(link => ({
        title: link.title || 'Resource',
        url: link.url,
        type: link.type?.toLowerCase() === 'youtube' ? 'youtube' : 'website',
        description: link.description || ''
      })).filter(link => link.url && link.url.startsWith('http'));
      
      console.log(`Returning ${validatedLinks.length} validated links`);
      return { 
        links: validatedLinks.slice(0, count), 
        sourceFound: true 
      };
    } catch (parseError) {
      console.error('Error parsing links from OpenAI response:', parseError);
      console.log('Raw response:', response);
      return { links: [], sourceFound: true };
    }
  } catch (error) {
    console.error('Error finding external resources:', error);
    return { links: [], sourceFound: false };
  }
}

module.exports = {
  initAlgolia,
  processTranscript,
  processTranscriptDirectory,
  searchTranscripts,
  getTranscriptsCount: () => localTranscripts.length,
  findExternalResources,
  loadExistingTranscripts
}; 