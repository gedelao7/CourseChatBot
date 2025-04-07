const fs = require('fs');
const path = require('path');
const axios = require('axios');
const extract = require('extract-zip');

const COURSE_ZIP_URL = 'https://www.dropbox.com/scl/fi/jnvuyjey2it9u6jld6ljt/DPT_6470-Cardiopulmonary_Practice.zip?rlkey=l7o14ye4vhb6af36ee2lldiia&st=jxecpazn&dl=1';
const DOWNLOAD_PATH = path.join(__dirname, '../data/course.zip');
const EXTRACT_PATH = path.join(__dirname, '../data/course');

// Ensure directories exist
function ensureDirectories() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(EXTRACT_PATH)) {
    fs.mkdirSync(EXTRACT_PATH, { recursive: true });
  }
}

// Download the course ZIP file
async function downloadCourseZip() {
  ensureDirectories();
  
  console.log('Downloading course ZIP file...');
  try {
    const response = await axios({
      method: 'get',
      url: COURSE_ZIP_URL,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(DOWNLOAD_PATH);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      writer.on('finish', () => {
        console.log('Download completed');
        resolve(DOWNLOAD_PATH);
      });
      
      writer.on('error', (err) => {
        console.error('Error downloading file:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error initiating download:', error);
    throw error;
  }
}

// Extract the ZIP file
async function extractCourseZip() {
  if (!fs.existsSync(DOWNLOAD_PATH)) {
    console.error('ZIP file not found. Please download it first.');
    return null;
  }
  
  console.log('Extracting course ZIP file...');
  try {
    await extract(DOWNLOAD_PATH, { dir: EXTRACT_PATH });
    console.log('Extraction completed');
    return EXTRACT_PATH;
  } catch (error) {
    console.error('Error extracting ZIP:', error);
    throw error;
  }
}

// Locate all transcript files within the extracted directory
function findTranscriptFiles() {
  if (!fs.existsSync(EXTRACT_PATH)) {
    console.error('Extracted folder not found. Please extract the ZIP first.');
    return [];
  }
  
  console.log('Searching for transcript files...');
  const transcriptFiles = [];
  
  function traverseDirectory(dirPath, moduleInfo = {}) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // If this is a module folder, update module info
        const isModuleFolder = /^Module/i.test(item);
        const newModuleInfo = isModuleFolder 
          ? { ...moduleInfo, module: item }
          : moduleInfo;
          
        // If this is a transcripts folder, process all files inside
        if (item.toLowerCase() === 'transcripts' || item.toLowerCase() === 'documents') {
          traverseDirectory(itemPath, { 
            ...moduleInfo, 
            type: item.toLowerCase() 
          });
        } else {
          traverseDirectory(itemPath, newModuleInfo);
        }
      } else if (stats.isFile()) {
        // Check if it's a transcript file type
        const ext = path.extname(item).toLowerCase();
        if (['.txt', '.vtt', '.srt', '.doc', '.docx', '.pdf'].includes(ext)) {
          transcriptFiles.push({
            path: itemPath, 
            module: moduleInfo.module || 'Unknown',
            type: moduleInfo.type || 'Unknown',
            filename: item
          });
        }
      }
    }
  }
  
  traverseDirectory(EXTRACT_PATH);
  console.log(`Found ${transcriptFiles.length} transcript files`);
  return transcriptFiles;
}

// Full pipeline: download, extract, and find transcripts
async function processCourseMaterials() {
  try {
    await downloadCourseZip();
    await extractCourseZip();
    return findTranscriptFiles();
  } catch (error) {
    console.error('Error processing course materials:', error);
    return [];
  }
}

module.exports = {
  downloadCourseZip,
  extractCourseZip,
  findTranscriptFiles,
  processCourseMaterials,
  EXTRACT_PATH
}; 