const fs = require('fs');
const path = require('path');
const algoliasearch = require('algoliasearch');

// Configure Algolia client
let algoliaClient = null;
let algoliaIndex = null;

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
    
    // If Algolia is initialized, index the document
    if (algoliaIndex) {
      await algoliaIndex.saveObject(document);
      console.log(`Indexed transcript: ${fileName}`);
    }
    
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

// Search for relevant content using Algolia
async function searchTranscripts(query, options = {}) {
  if (!algoliaIndex) {
    throw new Error('Algolia not initialized');
  }
  
  try {
    const searchResults = await algoliaIndex.search(query, options);
    return searchResults;
  } catch (error) {
    console.error('Error searching transcripts:', error);
    throw error;
  }
}

module.exports = {
  initAlgolia,
  processTranscript,
  processTranscriptDirectory,
  searchTranscripts
}; 