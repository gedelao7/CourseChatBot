import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

const QuizGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [transcriptsAvailable, setTranscriptsAvailable] = useState(false);

  // Check if transcripts are available
  useEffect(() => {
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

  const generateQuiz = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError(null);
    setQuizComplete(false);
    setUserAnswers([]);

    try {
      const response = await axios.post('http://localhost:5000/api/generate-quiz', {
        topic,
        count,
        difficulty
      });

      if (response.data.questions && response.data.questions.length > 0) {
        setQuestions(response.data.questions);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
      } else if (response.data.rawResponse) {
        setError('Could not parse AI response. Try a different topic or count.');
      } else {
        setError('No quiz questions generated. Try a different topic.');
      }
    } catch (error) {
      setError('Error generating quiz. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Save the user's answer before moving to the next question
      const newUserAnswers = [...userAnswers];
      newUserAnswers[currentQuestionIndex] = selectedAnswer !== null ? selectedAnswer : -1;
      setUserAnswers(newUserAnswers);
      
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      // Quiz is complete
      const finalUserAnswers = [...userAnswers];
      finalUserAnswers[currentQuestionIndex] = selectedAnswer !== null ? selectedAnswer : -1;
      setUserAnswers(finalUserAnswers);
      setQuizComplete(true);
    }
  };

  const calculateScore = () => {
    let correctCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
      if (userAnswers[i] === questions[i].answer) {
        correctCount++;
      }
    }
    
    return {
      correct: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100)
    };
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizComplete(false);
    setUserAnswers([]);
  };

  const createNewQuiz = () => {
    setQuestions([]);
    setTopic('');
    setQuizComplete(false);
    setUserAnswers([]);
  };

  return (
    <div className="quiz-container">
      <h2>Quiz Generator</h2>
      
      {!transcriptsAvailable && (
        <div className="transcript-notice">
          <span>No course transcripts available. Quiz questions will be generated from general knowledge.</span>
        </div>
      )}
      
      {questions.length === 0 ? (
        <div className="quiz-setup">
          <div className="controls">
            <div className="input-group">
              <label htmlFor="topic">Topic:</label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic (e.g., Respiratory Mechanics)"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="count">Number of questions:</label>
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
            
            <div className="input-group">
              <label htmlFor="difficulty">Difficulty:</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            
            <button 
              className="generate-button"
              onClick={generateQuiz}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Quiz'}
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : quizComplete ? (
        <div className="quiz-results">
          <h3>Quiz Complete!</h3>
          
          <div className="score-summary">
            <div className="score-circle">
              <div className="score-percentage">{calculateScore().percentage}%</div>
              <div className="score-text">
                {calculateScore().correct} of {calculateScore().total} correct
              </div>
            </div>
          </div>
          
          <div className="question-review">
            <h4>Review Questions</h4>
            {questions.map((question, index) => (
              <div key={index} className="review-question">
                <div className="question-text">{index + 1}. {question.question}</div>
                <div className="options-list">
                  {question.options.map((option, optIndex) => (
                    <div 
                      key={optIndex} 
                      className={`option ${userAnswers[index] === optIndex ? 'selected' : ''} ${
                        question.answer === optIndex ? 'correct' : ''
                      } ${userAnswers[index] === optIndex && userAnswers[index] !== question.answer ? 'incorrect' : ''}`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
                <div className="explanation">
                  <strong>Explanation:</strong> {question.explanation}
                </div>
              </div>
            ))}
          </div>
          
          <div className="quiz-actions">
            <button onClick={restartQuiz}>Restart Quiz</button>
            <button onClick={createNewQuiz}>Create New Quiz</button>
          </div>
        </div>
      ) : (
        <div className="quiz-active">
          <div className="question-progress">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          
          <div className="question-container">
            <div className="question-text">{questions[currentQuestionIndex].question}</div>
            
            <div className="options-list">
              {questions[currentQuestionIndex].options.map((option, index) => (
                <div 
                  key={index} 
                  className={`option ${selectedAnswer === index ? 'selected' : ''} ${
                    showExplanation && questions[currentQuestionIndex].answer === index ? 'correct' : ''
                  } ${showExplanation && selectedAnswer === index && selectedAnswer !== questions[currentQuestionIndex].answer ? 'incorrect' : ''}`}
                  onClick={() => !showExplanation && handleAnswerSelect(index)}
                >
                  {option}
                </div>
              ))}
            </div>
            
            {showExplanation && (
              <div className="explanation">
                <strong>Explanation:</strong> {questions[currentQuestionIndex].explanation}
              </div>
            )}
          </div>
          
          <div className="question-navigation">
            <button 
              onClick={nextQuestion} 
              disabled={selectedAnswer === null}
            >
              {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizGenerator; 