import React, { useState } from 'react';
import axios from 'axios';

interface Flashcard {
  front: string;
  back: string;
}

const FlashcardGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [transcriptsAvailable, setTranscriptsAvailable] = useState(false);

  // Check if transcripts are available
  React.useEffect(() => {
    const checkTranscripts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/transcript-stats');
        setTranscriptsAvailable(response.data.count > 0);
      } catch (error) {
        console.error('Error checking transcript stats:', error);
      }
    };
    
    checkTranscripts();
  }, []);

  const generateFlashcards = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:5000/api/generate-flashcards', {
        topic,
        count
      });

      if (response.data.flashcards && response.data.flashcards.length > 0) {
        setFlashcards(response.data.flashcards);
        setCurrentCardIndex(0);
        setIsFlipped(false);
      } else if (response.data.rawResponse) {
        setError('Could not parse AI response. Try a different topic or count.');
      } else {
        setError('No flashcards generated. Try a different topic.');
      }
    } catch (error) {
      setError('Error generating flashcards. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="flashcard-container">
      <h2>Flashcard Generator</h2>
      
      {!transcriptsAvailable && (
        <div className="transcript-notice">
          <span>No course transcripts available. Flashcards will be generated from general knowledge.</span>
        </div>
      )}
      
      <div className="controls">
        <div className="input-group">
          <label htmlFor="topic">Topic:</label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic (e.g., Lung Compliance)"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="count">Number of flashcards:</label>
          <select
            id="count"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
          >
            {[3, 5, 10, 15].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        
        <button 
          className="generate-button"
          onClick={generateFlashcards}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Flashcards'}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {flashcards.length > 0 && (
        <div className="flashcard-display">
          <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={flipCard}>
            <div className="card-front">
              <div className="card-content">{flashcards[currentCardIndex].front}</div>
              <div className="card-instructions">Click to flip</div>
            </div>
            <div className="card-back">
              <div className="card-content">{flashcards[currentCardIndex].back}</div>
              <div className="card-instructions">Click to flip</div>
            </div>
          </div>
          
          <div className="card-navigation">
            <button onClick={prevCard} disabled={currentCardIndex === 0}>Previous</button>
            <div className="card-counter">
              {currentCardIndex + 1} of {flashcards.length}
            </div>
            <button onClick={nextCard} disabled={currentCardIndex === flashcards.length - 1}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardGenerator; 