export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000/api'
  : 'https://chatbot75.netlify.app/.netlify/functions/api'; 