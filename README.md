# Course ChatBot

A specialized chatbot for educational courses that answers student questions based on lecture transcripts, generates quizzes, and creates flashcards for study.

## Features Checklist

### Transcript Processing ✅
- [x] Set up folder structure for transcript files
- [x] Process transcripts from local folder
- [x] Load transcripts on server startup
- [x] Semantic search through transcript content
- [x] Display transcript availability in UI
- [ ] Add drag-and-drop transcript upload (optional enhancement)

### AI Integration ✅
- [x] Connect to OpenAI API for chat responses
- [x] Generate responses based on relevant transcript content
- [x] Generate flashcards from course content
- [x] Generate quizzes from course content
- [x] Fallback to general knowledge when specific content not found

### User Interface ✅
- [x] Responsive chat interface
- [x] Typing animation effect
- [x] Interactive flashcard system
- [x] Interactive quiz system
- [x] Navigation sidebar
- [x] Transcript status indicator

### Data Collection
- [x] Log user questions and interactions
- [ ] Advanced analytics dashboard (future enhancement)

### LMS Integration (Planned)
- [ ] Create iframe-compatible version
- [ ] Implement Canvas LTI integration
- [ ] Add authentication for student tracking

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install` in both frontend and backend directories
3. Place course transcript files in `backend/data/course` directory
4. Create a `.env` file in the backend directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
5. Start the backend server with `npm start` in the backend directory
6. Start the frontend with `npm start` in the frontend directory
7. Access the application at `http://localhost:3000`

## Note on Transcript Processing

The system will automatically process transcript files placed in the `backend/data/course` directory on server startup. Supported file formats include `.txt`, `.vtt`, `.srt`, `.doc`, `.docx`, and `.pdf`. 