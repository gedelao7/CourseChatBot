import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

interface Message {
  type: 'user' | 'bot';
  content: string;
  isTyping?: boolean;
  fullContent?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', content: 'Hello! I\'m your Cardiopulmonary Course Assistant. Ask me anything about the course materials.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<string | null>(null);
  const [maxLength, setMaxLength] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingSpeed = 15; // milliseconds per character

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

      // Log the interaction for analytics
      logQuestion(userMessage, true);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const logQuestion = async (question: string, wasHelpful: boolean) => {
    try {
      await axios.post(`${API_URL}/api/log-question`, {
        question,
        wasHelpful
      });
    } catch (error) {
      console.error('Error logging question:', error);
    }
  };

  return (
    <div className="chat-container">
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
    </div>
  );
};

export default ChatInterface; 