import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

interface Message {
  type: 'user' | 'bot';
  content: string;
  isTyping?: boolean;
  fullContent?: string;
}

interface TranscriptStats {
  count: number;
  algoliaConnected: boolean;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', content: 'Hello! I\'m your Cardiopulmonary Course Assistant. Ask me anything about the course materials.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [format, setFormat] = useState<string | null>(null);
  const [maxLength, setMaxLength] = useState<number | null>(null);
  const [transcriptStats, setTranscriptStats] = useState<TranscriptStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingSpeed = 15; // milliseconds per character

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch transcript stats on component mount
  useEffect(() => {
    const fetchTranscriptStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/transcript-stats`);
        setTranscriptStats(response.data);
      } catch (error) {
        console.error('Error fetching transcript stats:', error);
      }
    };

    fetchTranscriptStats();
  }, []);

  // Typing animation effect
  useEffect(() => {
    const currentMessages = [...messages];
    const typingMessageIndex = currentMessages.findIndex(
      message => message.isTyping && message.fullContent
    );

    if (typingMessageIndex !== -1) {
      const typingMessage = currentMessages[typingMessageIndex];
      if (typingMessage.content.length < (typingMessage.fullContent?.length || 0)) {
        const timer = setTimeout(() => {
          const nextChar = typingMessage.fullContent?.charAt(typingMessage.content.length) || '';
          
          currentMessages[typingMessageIndex] = {
            ...typingMessage,
            content: typingMessage.content + nextChar
          };
          
          setMessages([...currentMessages]);
        }, typingSpeed);
        
        return () => clearTimeout(timer);
      } else {
        // Typing is complete
        currentMessages[typingMessageIndex] = {
          ...typingMessage,
          isTyping: false
        };
        setMessages([...currentMessages]);
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    
    setIsLoading(true);
    
    try {
      // Send request to backend
      const response = await axios.post(`${API_URL}/api/chat`, {
        message: userMessage,
        format: format,
        maxLength: maxLength
      });

      // Set loading to false
      setIsLoading(false);

      // Add bot response with typing animation
      setMessages(prev => [
        ...prev, 
        { 
          type: 'bot', 
          content: '', 
          fullContent: response.data.response,
          isTyping: true
        }
      ]);

      // Update transcript stats if needed
      if (response.data.transcriptsAvailable !== undefined && 
          (!transcriptStats || transcriptStats.count === 0)) {
        setTranscriptStats(prev => ({
          ...prev || { algoliaConnected: false },
          count: response.data.transcriptsAvailable ? 1 : 0
        }));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    }
  };

  const handleProcessTranscripts = async () => {
    setIsProcessing(true);
    
    try {
      await axios.post(`${API_URL}/api/process-course`);
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: 'Processing course materials. This may take a few minutes. I\'ll be able to answer course-specific questions once processing is complete.'
      }]);
      
      // Fetch updated stats after a delay to allow processing
      setTimeout(async () => {
        try {
          const response = await axios.get(`${API_URL}/api/transcript-stats`);
          setTranscriptStats(response.data);
          
          if (response.data.count > 0) {
            setMessages(prev => [...prev, { 
              type: 'bot', 
              content: `Successfully processed ${response.data.count} transcript files! You can now ask me questions about the course content.`
            }]);
          }
        } catch (error) {
          console.error('Error fetching updated transcript stats:', error);
        }
        setIsProcessing(false);
      }, 5000);
    } catch (error) {
      console.error('Error processing transcripts:', error);
      setIsProcessing(false);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: 'Sorry, I encountered an error while processing the course materials. Please make sure the transcript files are in the backend/data/course directory.'
      }]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      {transcriptStats && transcriptStats.count === 0 && (
        <div className="transcript-notice">
          <p>No course materials loaded yet. Answers will be general knowledge until transcripts are processed.</p>
          <button 
            className="process-button" 
            onClick={handleProcessTranscripts}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Process Transcripts'}
          </button>
        </div>
      )}
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}`}>
            <div className="message-content">
              {message.content}
              {message.isTyping && (
                <span className="typing-cursor">|</span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-content">
              <div className="loading">
                <div className="loading-dots">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-options">
        <button 
          className={`option-button ${format === 'bullet points' ? 'active' : ''}`}
          onClick={() => setFormat(format === 'bullet points' ? null : 'bullet points')}
        >
          Bullet Points
        </button>
        <button 
          className={`option-button ${format === 'paragraph' ? 'active' : ''}`}
          onClick={() => setFormat(format === 'paragraph' ? null : 'paragraph')}
        >
          Paragraph
        </button>
        <button 
          className={`option-button ${maxLength === 1 ? 'active' : ''}`}
          onClick={() => setMaxLength(maxLength === 1 ? null : 1)}
        >
          One Sentence
        </button>
        <button 
          className={`option-button ${maxLength === 3 ? 'active' : ''}`}
          onClick={() => setMaxLength(maxLength === 3 ? null : 3)}
        >
          Brief (3 Sentences)
        </button>
      </div>
      
      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your question here..."
          disabled={isLoading}
        />
        <button 
          className="send-button" 
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
        >
          ➤
        </button>
      </div>

      {transcriptStats && (
        <div className="transcript-stats">
          <span>
            {transcriptStats.count} transcript files loaded
            {transcriptStats.algoliaConnected ? ' (Algolia connected)' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default ChatInterface; 