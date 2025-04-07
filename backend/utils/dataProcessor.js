const fs = require('fs');
const path = require('path');
const algoliasearch = require('algoliasearch');

// Configure Algolia client
let algoliaClient = null;
let algoliaIndex = null;

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
  
  // Simple keyword-based search
  const keywords = query.toLowerCase().split(/\s+/);
  
  // Score documents based on keyword matches
  const scoredDocs = localTranscripts.map(doc => {
    const content = doc.content.toLowerCase();
    const title = doc.title.toLowerCase();
    
    // Calculate score based on keyword frequency
    let score = 0;
    keywords.forEach(keyword => {
      // Title matches are weighted more heavily
      const titleMatches = (title.match(new RegExp(keyword, 'g')) || []).length;
      const contentMatches = (content.match(new RegExp(keyword, 'g')) || []).length;
      
      score += titleMatches * 3 + contentMatches;
    });
    
    return { ...doc, score };
  });
  
  // Sort by score and return top results
  const results = scoredDocs
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // Return top 5 results
  
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

module.exports = {
  initAlgolia,
  processTranscript,
  processTranscriptDirectory,
  searchTranscripts,
  getTranscriptsCount: () => localTranscripts.length
}; 