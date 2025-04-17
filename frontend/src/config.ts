export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000'
  : window.location.origin.includes('netlify.app')
    ? 'https://chatbot75.netlify.app/.netlify/functions'
    : 'https://chatbot75.netlify.app/.netlify/functions'; 