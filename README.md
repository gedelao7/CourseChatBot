# Cardiopulmonary Course AI Chatbot

An AI-powered chatbot that specializes in answering questions about cardiopulmonary course content. The chatbot is trained on lecture transcripts and course materials to provide accurate, contextual responses to student questions.

## Features

- **AI-Powered Course Assistant**: Chat with an AI that understands cardiopulmonary topics based on course transcripts
- **Flashcard Generation**: Create study flashcards for any course topic on demand
- **Quiz Generation**: Generate course-specific quiz questions with varying difficulty levels
- **Format Controls**: Specify response format (bullet points, paragraphs) and length (single sentence, brief)
- **Data Collection**: Captures student questions for improving the chatbot over time
- **Lecture Material Integration**: Trained on course transcripts, documents, and handouts

## Project Structure

```
CourseChatBot/
├── backend/               # Express server & API endpoints
│   ├── utils/             # Utility functions for data processing
│   │   ├── dataProcessor.js   # Processes and indexes course content
│   │   └── courseDownloader.js # Downloads and extracts course materials
│   ├── server.js          # Main server file
│   └── .env               # Environment variables
├── frontend/              # React frontend
│   ├── public/            # Static files
│   └── src/               # React components
│       ├── components/    # UI components
│       │   ├── ChatInterface.js  # Chat component
│       │   ├── Flashcards.js     # Flashcard generator
│       │   ├── Quiz.js           # Quiz generator
│       │   ├── Header.js         # App header
│       │   └── Sidebar.js        # Navigation sidebar
│       ├── App.js         # Main React app
│       └── App.css        # Styles
└── package.json           # Root package.json for scripts
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- OpenAI API key
- Algolia account (optional for better search)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/CourseChatBot.git
   cd CourseChatBot
   ```

2. Install dependencies for both frontend and backend:
   ```
   npm run install:all
   ```

3. Configure API keys:
   - Create/edit `.env` file in the backend directory
   ```
   OPENAI_API_KEY=your_openai_api_key
   ALGOLIA_APP_ID=your_algolia_app_id (optional)
   ALGOLIA_API_KEY=your_algolia_api_key (optional)
   ALGOLIA_INDEX_NAME=course_transcripts (optional)
   PORT=5000
   ```

4. Start the development servers:
   ```
   npm start
   ```
   This will start both the backend server (http://localhost:5000) and frontend (http://localhost:3000)

### Course Content Processing

1. Download and index course materials:
   - Use the `/api/process-course` endpoint to download and process the course ZIP file
   - This will extract transcripts and documents for the AI to reference
   - Note: This process may take several minutes

## Usage

1. **Chat**: Ask questions about cardiopulmonary topics covered in the course
2. **Format Controls**: Specify how responses should be formatted
3. **Flashcards**: Generate study flashcards by topic
4. **Quiz**: Create interactive quizzes with customizable difficulty

## Implementation Details

### Backend

- Express.js server for API endpoints
- OpenAI integration for AI responses
- Algolia for efficient transcript searching (optional)
- Custom modules for processing and indexing course materials

### Frontend

- React for UI components
- Modern, responsive design
- Interactive components for chat, flashcards, and quizzes
- Format controls for customizing AI responses

## Future Enhancements

- Canvas LMS integration via iframe
- Enhanced analytics dashboard
- User authentication
- Video content understanding
- Continuous model training based on student interactions

## License

This project is licensed under the MIT License. 