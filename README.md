# Cardiopulmonary Course Chatbot

A chatbot assistant for the Cardiopulmonary Practice course that helps students with course-related questions, flashcards, and quizzes.

## Setup Instructions

1. Extract the contents of `chatbot-full.zip` to your desired location.

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file in the backend directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PORT=5000
   ```

5. Start the backend server:
   ```bash
   npm start
   ```

6. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```

7. Install frontend dependencies:
   ```bash
   npm install
   ```

8. Start the frontend development server:
   ```bash
   npm start
   ```

The chatbot should now be accessible at `http://localhost:3000`.

## Features

- Course-related Q&A
- Flashcard generation
- Quiz creation
- Transcript processing
- Local search functionality

## Development

- Frontend: React with TypeScript
- Backend: Node.js with Express
- OpenAI API integration
- Local transcript storage and search

## Deployment

For production deployment:

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. The backend server should be running to handle API requests.

3. Configure your web server to serve the frontend build files and proxy API requests to the backend server.

## Troubleshooting

- Ensure the backend server is running before accessing the frontend
- Check that the OpenAI API key is valid and properly set in the `.env` file
- Verify that the course data is present in the `backend/data/course` directory 