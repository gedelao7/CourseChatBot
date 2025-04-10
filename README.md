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

## Canvas LMS Integration

The chatbot is designed to be embedded within Canvas LMS using an iframe. This allows instructors to integrate the course assistant directly into their Canvas courses.

### Iframe Integration

1. Build the frontend application for production:
   ```
   cd frontend
   npm run build
   ```

2. Host the built application on your web server or hosting platform.

3. In Canvas, navigate to your course and create a new Page.

4. Click the HTML Editor button (<>) and add the following iframe code:
   ```html
   <iframe 
     src="https://your-chatbot-domain.com" 
     width="100%" 
     height="600px" 
     style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);" 
     title="Course Chatbot"
     allowfullscreen
   ></iframe>
   ```

5. Adjust the height as needed to fit your course layout.

### LTI Integration (Future Enhancement)

For a more seamless integration, we plan to implement Canvas LTI support. A sample LTI configuration file is provided at `frontend/public/canvas-lti-config.json` for reference.

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