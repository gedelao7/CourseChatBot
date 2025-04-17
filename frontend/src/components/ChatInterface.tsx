import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Import flashcard and quiz related types and functionality
interface Flashcard {
  front: string;
  back: string;
  isFlipped?: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface Message {
  content: string;
  role: 'user' | 'bot';
  isTyping: boolean;
  fullContent: string;
  isOffTopic?: boolean;
  isFlashcards?: boolean;
  isQuiz?: boolean;
  isExternalLinks?: boolean;
  suggestedTopics?: string[];
  flashcards?: Flashcard[];
  currentCardIndex?: number;
  externalLinks?: {
    title: string;
    url: string;
    type: 'website' | 'youtube';
    description?: string;
  }[];
  quizData?: {
    questions: QuizQuestion[];
    topic: string;
    currentQuestionIndex: number;
    selectedAnswer: string | null;
    showExplanation: boolean;
    quizComplete: boolean;
    userAnswers: string[];
  };
}

interface TranscriptStats {
  count: number;
  algoliaConnected: boolean;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content: 'Hello! I am your Cardiopulmonary Course Assistant. How can I help you today?',
      isTyping: false,
      fullContent: 'Hello! I am your Cardiopulmonary Course Assistant. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptStats, setTranscriptStats] = useState<TranscriptStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingSpeed = 15; // milliseconds per character
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Add scroll event listener to track manual scrolling
  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (messagesContainer) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        // If user is near bottom (within 100px), consider it auto-scrolled
        setIsScrolled(scrollHeight - scrollTop - clientHeight > 100);
      };

      messagesContainer.addEventListener('scroll', handleScroll);
      return () => messagesContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Only auto-scroll if not manually scrolled
  useEffect(() => {
    if (!isScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolled]);

  // Reset scroll state when new message is added
  useEffect(() => {
    if (messages.length > 0) {
      setIsScrolled(false);
    }
  }, [messages.length]);

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

  // Check if message is a flashcard request
  const isFlashcardRequest = (message: string): boolean => {
    const lowercaseMsg = message.toLowerCase();
    return (
      lowercaseMsg.includes('flashcard') || 
      lowercaseMsg.includes('flash card') || 
      (lowercaseMsg.includes('card') && lowercaseMsg.includes('create')) ||
      (lowercaseMsg.includes('card') && lowercaseMsg.includes('make'))
    );
  };

  // Check if message is a quiz request
  const isQuizRequest = (message: string): boolean => {
    const lowercaseMsg = message.toLowerCase();
    return (
      lowercaseMsg.includes('quiz') || 
      lowercaseMsg.includes('test me') || 
      lowercaseMsg.includes('create a test') ||
      lowercaseMsg.includes('generate questions') ||
      (lowercaseMsg.includes('question') && lowercaseMsg.includes('make'))
    );
  };

  // Check if message is a request for external links
  const isExternalLinkRequest = (message: string): boolean => {
    const lowercaseMsg = message.toLowerCase();
    return (
      lowercaseMsg.includes('link') || 
      lowercaseMsg.includes('resource') || 
      lowercaseMsg.includes('website') || 
      lowercaseMsg.includes('video') || 
      lowercaseMsg.includes('youtube') || 
      lowercaseMsg.includes('find me') || 
      (lowercaseMsg.includes('show') && lowercaseMsg.includes('me')) ||
      (lowercaseMsg.includes('search') && (lowercaseMsg.includes('for') || lowercaseMsg.includes('about')))
    );
  };

  // Add function to detect if a question references specific lecture numbers
  const isLectureReferenceQuestion = (message: string): boolean => {
    const lowercaseMsg = message.toLowerCase();
    return (
      lowercaseMsg.includes('lecture') && 
      (lowercaseMsg.match(/\blecture\s+\d+\b/) !== null || 
       lowercaseMsg.match(/\blectures?\s+[a-z]+\b/) !== null)
    );
  };

  // Enhanced topic extraction from message
  const extractTopic = (message: string): string => {
    const lowercaseMsg = message.toLowerCase();
    
    // Special case for direct questions about lectures
    const lectureMatch = lowercaseMsg.match(/lecture\s+(\d+|[a-z]+)/i);
    if (lectureMatch && lectureMatch[1]) {
      return `lecture ${lectureMatch[1]}`;
    }
    
    // Try to find "about [topic]" pattern
    const aboutMatch = lowercaseMsg.match(/(?:about|on|for|regarding|related to)\s+([^.,?!]+)/i);
    if (aboutMatch && aboutMatch[1]) {
      return aboutMatch[1].trim();
    }
    
    // If no "about" pattern, try finding the topic after "flashcard" or "quiz"
    if (isFlashcardRequest(message)) {
      const fcMatch = lowercaseMsg.match(/flashcards?\s+(?:about|on|for|regarding|related to)?\s+([^.,?!]+)/i);
      if (fcMatch && fcMatch[1]) {
        return fcMatch[1].trim();
      }
    }
    
    if (isQuizRequest(message)) {
      const quizMatch = lowercaseMsg.match(/quiz\s+(?:about|on|for|regarding|related to)?\s+([^.,?!]+)/i);
      if (quizMatch && quizMatch[1]) {
        return quizMatch[1].trim();
      }
    }
    
    // If this is an external resource request
    if (isExternalLinkRequest(message)) {
      const resourceMatch = lowercaseMsg.match(/(?:find|search|get|show)\s+(?:me)?\s+(?:resources|links|videos|information)\s+(?:about|on|for|regarding|related to)?\s+([^.,?!]+)/i);
      if (resourceMatch && resourceMatch[1]) {
        return resourceMatch[1].trim();
      }
    }
    
    // Try to find direct question patterns 
    const whatIsMatch = lowercaseMsg.match(/what(?:\s+is|\s+are|\s+were|\s+does|\s+do)?\s+(?:a|an|the)?\s+([^.,?!]+)/i);
    if (whatIsMatch && whatIsMatch[1] && whatIsMatch[1].length > 3) {
      return whatIsMatch[1].trim();
    }
    
    const howDoesMatch = lowercaseMsg.match(/how\s+(?:does|do|can|could|would|should)\s+(?:a|an|the)?\s+([^.,?!]+)/i);
    if (howDoesMatch && howDoesMatch[1] && howDoesMatch[1].length > 3) {
      return howDoesMatch[1].trim();
    }
    
    // If still no match, try to find any nouns after common words
    const topicMatch = lowercaseMsg.match(/(?:create|make|generate|give me)\s+(?:some|a|an)?\s+(?:flashcards?|quiz|test|questions?)\s+(?:about|on|for|regarding|related to)?\s+([^.,?!]+)/i);
    if (topicMatch && topicMatch[1]) {
      return topicMatch[1].trim();
    }
    
    // Last resort: extract main noun phrases from the question
    // This is a simple version - for a production app, consider using NLP libraries
    const words = lowercaseMsg.split(/\s+/);
    const stopWords = ['a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'is', 'are', 'was', 'were'];
    const filteredWords = words.filter(word => !stopWords.includes(word) && word.length > 3);
    
    if (filteredWords.length > 0) {
      // Use the longest word or phrase as a fallback
      return filteredWords.sort((a, b) => b.length - a.length)[0];
    }
    
    return "";
  };

  // Handle flashcard generation
  const handleFlashcardRequest = async (userMessage: string) => {
    const topic = extractTopic(userMessage);
    if (!topic) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'What topic would you like flashcards on? Please specify a course-related topic.',
        isTyping: false,
        fullContent: 'What topic would you like flashcards on? Please specify a course-related topic.'
      } as Message]);
      return;
    }

    setIsLoading(true);
    
    try {
      // First, check if topic is relevant to course materials
      const relevanceCheck = await axios.post(`${API_URL}/api/chat`, {
        message: `Is ${topic} covered in the course materials?`,
        format: null,
        maxLength: null
      });

      // Check if the topic is off-topic based on the response
      const isOffTopic = relevanceCheck.data.offtopic === true;

      if (isOffTopic) {
        setIsLoading(false);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I can only create flashcards for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for flashcards related to the course content.`,
          isTyping: false,
          fullContent: `I can only create flashcards for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for flashcards related to the course content.`,
          isOffTopic: true
        } as Message]);
        return;
      }

      // Default to 5 flashcards unless specified
      const count = userMessage.match(/(\d+)\s+(?:cards|flashcards)/i) 
        ? parseInt(userMessage.match(/(\d+)\s+(?:cards|flashcards)/i)![1]) 
        : 5;
      
      const response = await axios.post(`${API_URL}/api/generate-flashcards`, {
        topic,
        count
      });

      setIsLoading(false);

      if (response.data.flashcards && response.data.flashcards.length > 0 && response.data.sourceFound) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `Here are ${count} flashcards about "${topic}":`,
          isTyping: false,
          fullContent: `Here are ${count} flashcards about "${topic}":`,
          isFlashcards: true,
          flashcards: response.data.flashcards,
          currentCardIndex: 0
        } as Message]);
      } else if (response.data.flashcards && response.data.flashcards.length > 0) {
        // We have flashcards but no specific source found in transcripts
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isOffTopic: true
        } as Message]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't generate flashcards for "${topic}". Please try a different course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't generate flashcards for "${topic}". Please try a different course-related topic.`
        } as Message]);
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'Sorry, I encountered an error generating flashcards. Please try again.',
        isTyping: false,
        fullContent: 'Sorry, I encountered an error generating flashcards. Please try again.'
      } as Message]);
    }
  };

  // Handle quiz generation
  const handleQuizRequest = async (userMessage: string) => {
    const topic = extractTopic(userMessage);
    if (!topic) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'What topic would you like a quiz on? Please specify a course-related topic.',
        isTyping: false,
        fullContent: 'What topic would you like a quiz on? Please specify a course-related topic.'
      } as Message]);
      return;
    }

    setIsLoading(true);
    
    try {
      // First, check if topic is relevant to course materials
      const relevanceCheck = await axios.post(`${API_URL}/api/chat`, {
        message: `Is ${topic} covered in the course materials?`,
        format: null,
        maxLength: null
      });
      
      // Check if the topic is off-topic based on the response
      const isOffTopic = relevanceCheck.data.offtopic === true;

      if (isOffTopic) {
        setIsLoading(false);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I can only create quizzes for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for a quiz related to the course content.`,
          isTyping: false,
          fullContent: `I can only create quizzes for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for a quiz related to the course content.`,
          isOffTopic: true
        } as Message]);
        return;
      }

      // Extract parameters from the message
      const countMatch = userMessage.match(/(\d+)\s+(?:questions|quiz questions)/i);
      const count = countMatch ? parseInt(countMatch[1]) : 5;
      
      let difficulty = 'medium';
      if (userMessage.toLowerCase().includes('easy')) difficulty = 'easy';
      if (userMessage.toLowerCase().includes('hard') || userMessage.toLowerCase().includes('difficult')) difficulty = 'hard';
      
      const response = await axios.post(`${API_URL}/api/generate-quiz`, {
        topic,
        count,
        difficulty
      });

      setIsLoading(false);

      if (response.data.questions && response.data.questions.length > 0 && response.data.sourceFound) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `Here's a ${difficulty} difficulty quiz with ${count} questions about "${topic}":`,
          isTyping: false,
          fullContent: `Here's a ${difficulty} difficulty quiz with ${count} questions about "${topic}":`,
          isQuiz: true,
          quizData: {
            questions: response.data.questions,
            topic: topic,
            currentQuestionIndex: 0,
            selectedAnswer: null,
            showExplanation: false,
            quizComplete: false,
            userAnswers: []
          }
        } as Message]);
      } else if (response.data.questions && response.data.questions.length > 0) {
        // We have questions but no specific source found in transcripts
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isOffTopic: true
        } as Message]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't generate a quiz for "${topic}". Please try a different course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't generate a quiz for "${topic}". Please try a different course-related topic.`
        } as Message]);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'Sorry, I encountered an error generating the quiz. Please try again.',
        isTyping: false,
        fullContent: 'Sorry, I encountered an error generating the quiz. Please try again.'
      } as Message]);
    }
  };

  // Handle external link request
  const handleExternalLinkRequest = async (userMessage: string) => {
    const topic = extractTopic(userMessage);
    if (!topic) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'What topic would you like to find external resources for? Please specify a course-related topic.',
        isTyping: false,
        fullContent: 'What topic would you like to find external resources for? Please specify a course-related topic.'
      } as Message]);
      return;
    }

    setIsLoading(true);
    
    try {
      // First, check if topic is relevant to course materials
      const relevanceCheck = await axios.post(`${API_URL}/api/chat`, {
        message: `Is ${topic} covered in the course materials?`,
        format: null,
        maxLength: null
      });

      // Check if the topic is off-topic based on the response
      const isOffTopic = relevanceCheck.data.offtopic === true;

      if (isOffTopic) {
        setIsLoading(false);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I can only provide external resources for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for resources related to the course content.`,
          isTyping: false,
          fullContent: `I can only provide external resources for topics covered in the course materials. "${topic}" doesn't appear to be covered in the transcripts I have. Please ask for resources related to the course content.`,
          isOffTopic: true
        } as Message]);
        return;
      }

      // Detect what type of resources are being requested
      const wantsVideos = userMessage.toLowerCase().includes('video') || 
                          userMessage.toLowerCase().includes('youtube') || 
                          userMessage.toLowerCase().includes('watch');
      
      const wantsWebsites = userMessage.toLowerCase().includes('website') || 
                           userMessage.includes('article') || 
                           userMessage.includes('page') ||
                           userMessage.includes('link');
      
      // Default to both if not specified
      const resourceType = {
        videos: wantsVideos || (!wantsVideos && !wantsWebsites),
        websites: wantsWebsites || (!wantsVideos && !wantsWebsites)
      };
      
      // Number of resources to find (default: 3)
      const count = userMessage.match(/(\d+)\s+(?:links|resources|videos|websites)/i) 
        ? parseInt(userMessage.match(/(\d+)\s+(?:links|resources|videos|websites)/i)![1]) 
        : 3;
      
      const response = await axios.post(`${API_URL}/api/find-external-resources`, {
        topic,
        count,
        resourceType
      });

      setIsLoading(false);

      if (response.data.links && response.data.links.length > 0 && response.data.sourceFound) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `Here are some external resources about "${topic}" from reliable sources:`,
          isTyping: false,
          fullContent: `Here are some external resources about "${topic}" from reliable sources:`,
          isExternalLinks: true,
          externalLinks: response.data.links
        } as Message]);
      } else if (response.data.links && response.data.links.length > 0) {
        // We have links but no specific source found in transcripts
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't find specific information about "${topic}" in the course materials. Please try a different course-related topic.`,
          isOffTopic: true
        } as Message]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `I couldn't find external resources for "${topic}". Please try a more specific course-related topic.`,
          isTyping: false,
          fullContent: `I couldn't find external resources for "${topic}". Please try a more specific course-related topic.`
        } as Message]);
      }
    } catch (error) {
      console.error('Error finding external resources:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: 'Sorry, I encountered an error finding external resources. Please try again.',
        isTyping: false,
        fullContent: 'Sorry, I encountered an error finding external resources. Please try again.'
      } as Message]);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (input.trim() === '') return;
    
    const newMessage: Message = {
      role: 'user',
      content: input,
      isTyping: false,
      fullContent: input
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Check if it's a flashcard or quiz request before proceeding to general chat
      if (isFlashcardRequest(input)) {
        await handleFlashcardRequest(input);
        return;
      }
      
      if (isQuizRequest(input)) {
        await handleQuizRequest(input);
        return;
      }
      
      // Check if it's an external link request
      if (isExternalLinkRequest(input)) {
        await handleExternalLinkRequest(input);
        return;
      }
      
      // Send request to backend
      const response = await axios.post(`${API_URL}/api/chat`, {
        message: input,
        format: null,
        maxLength: null,
        isLectureReference: isLectureReferenceQuestion(input)
      });

      // Check if it's an off-topic question
      const isOffTopic = response.data.offtopic === true;
      const suggestedTopics = response.data.suggestedTopics || [];

      // Add bot response with typing animation
      setMessages(prev => [
        ...prev, 
        { 
          role: 'bot', 
          content: '', 
          fullContent: response.data.response,
          isTyping: true,
          isOffTopic: isOffTopic,
          suggestedTopics: suggestedTopics
        } as Message
      ]);

      // Set loading to false after starting the typing animation
      setIsLoading(false);

      // Update transcript stats if needed
      if (response.data.transcriptsAvailable !== undefined && 
          (!transcriptStats || transcriptStats.count === 0)) {
        setTranscriptStats(prev => ({
          ...prev || { algoliaConnected: false },
          count: response.data.transcriptsAvailable ? 1 : 0
        }));
      }
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleSubmit();
  };

  // Flashcard UI handlers
  const handleFlipCard = (messageIndex: number, cardIndex: number) => {
    setMessages(prev => {
      const updatedMessages = [...prev];
      const message = updatedMessages[messageIndex];
      
      if (message.flashcards) {
        // Toggle the "flipped" state for this card
        const updatedFlashcards = [...message.flashcards];
        updatedFlashcards[cardIndex] = {
          ...updatedFlashcards[cardIndex],
          isFlipped: !updatedFlashcards[cardIndex].isFlipped
        };
        
        updatedMessages[messageIndex] = {
          ...message,
          flashcards: updatedFlashcards
        };
      }
      
      return updatedMessages;
    });
  };

  // Quiz UI handlers
  const handleAnswerSelect = (messageIndex: number, answerIndex: number) => {
    setMessages(prev => {
      const updatedMessages = [...prev];
      const message = updatedMessages[messageIndex];
      
      if (message.quizData && !message.quizData.showExplanation) {
        updatedMessages[messageIndex] = {
          ...message,
          quizData: {
            ...message.quizData,
            selectedAnswer: answerIndex.toString(),
            showExplanation: true
          }
        };
      }
      
      return updatedMessages;
    });
  };

  const handleNextQuestion = (messageIndex: number) => {
    setMessages(prev => {
      const updatedMessages = [...prev];
      const message = updatedMessages[messageIndex];
      
      if (message.quizData) {
        const quizData = message.quizData;
        const isLastQuestion = quizData.currentQuestionIndex === quizData.questions.length - 1;
        
        if (isLastQuestion) {
          // Complete the quiz
          const updatedAnswers = [...quizData.userAnswers];
          updatedAnswers[quizData.currentQuestionIndex] = quizData.selectedAnswer || '';
          
          updatedMessages[messageIndex] = {
            ...message,
            quizData: {
              ...quizData,
              quizComplete: true,
              userAnswers: updatedAnswers
            }
          };
        } else {
          // Move to next question
          const updatedAnswers = [...quizData.userAnswers];
          updatedAnswers[quizData.currentQuestionIndex] = quizData.selectedAnswer || '';
          
          updatedMessages[messageIndex] = {
            ...message,
            quizData: {
              ...quizData,
              currentQuestionIndex: quizData.currentQuestionIndex + 1,
              selectedAnswer: null,
              showExplanation: false,
              userAnswers: updatedAnswers
            }
          };
        }
      }
      
      return updatedMessages;
    });
  };

  const calculateQuizScore = (quizData: Message['quizData']) => {
    if (!quizData) return { correct: 0, total: 0, percentage: 0 };
    
    let correctCount = 0;
    for (let i = 0; i < quizData.questions.length; i++) {
      if (quizData.userAnswers[i] === quizData.questions[i].answer.toString()) {
        correctCount++;
      }
    }
    
    return {
      correct: correctCount,
      total: quizData.questions.length,
      percentage: Math.round((correctCount / quizData.questions.length) * 100)
    };
  };

  const restartQuiz = (messageIndex: number) => {
    setMessages(prev => {
      const updatedMessages = [...prev];
      const message = updatedMessages[messageIndex];
      
      if (message.quizData) {
        updatedMessages[messageIndex] = {
          ...message,
          quizData: {
            ...message.quizData,
            currentQuestionIndex: 0,
            selectedAnswer: null,
            showExplanation: false,
            quizComplete: false,
            userAnswers: []
          }
        };
      }
      
      return updatedMessages;
    });
  };

  const handleProcessTranscripts = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/process-course`);
      if (response.data.success) {
        setMessages(prev => [...prev, { 
          role: 'bot',
          content: 'Transcripts processed successfully! You can now ask questions about the course content.',
          isTyping: false,
          fullContent: 'Transcripts processed successfully! You can now ask questions about the course content.'
        } as Message]);
        const statsResponse = await axios.get(`${API_URL}/api/transcript-stats`);
        setTranscriptStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error processing transcripts:', error);
      setMessages(prev => [...prev, { 
        role: 'bot',
        content: 'Error processing transcripts. Please try again.',
        isTyping: false,
        fullContent: 'Error processing transcripts. Please try again.'
      } as Message]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render flashcard UI
  const renderFlashcards = (message: Message, index: number) => {
    if (!message.flashcards || message.currentCardIndex === undefined) return null;
    
    const cardIndex = message.currentCardIndex;
    const totalCards = message.flashcards.length;
    const currentCard = message.flashcards[cardIndex];
    
    const flashcard = (
      <div 
        className={`flashcard ${currentCard.isFlipped ? 'flipped' : ''}`} 
        onClick={() => handleFlipCard(index, cardIndex)}
      >
        <div className="card-front">
          <div className="card-content">{currentCard.front}</div>
          <div className="card-instructions">Click to flip</div>
        </div>
        <div className="card-back">
          <div className="card-content">{currentCard.back}</div>
          <div className="card-instructions">Click to flip</div>
        </div>
      </div>
    );
    
    return (
      <div className="flashcard-display chat-flashcards">
        {flashcard}
        <div className="card-navigation">
          <button onClick={() => navigateFlashcard(index, 'prev')} disabled={cardIndex === 0}>Previous</button>
          <div className="card-counter">
            {cardIndex + 1} of {totalCards}
          </div>
          <button onClick={() => navigateFlashcard(index, 'next')} disabled={cardIndex === totalCards - 1}>Next</button>
        </div>
      </div>
    );
  };

  // Add flashcard navigation
  const navigateFlashcard = (messageIndex: number, direction: 'prev' | 'next') => {
    setMessages(prev => {
      const updatedMessages = [...prev];
      const message = updatedMessages[messageIndex];
      
      if (message.flashcards && message.currentCardIndex !== undefined) {
        // Reset flip state when navigating
        const updatedFlashcards = [...message.flashcards];
        updatedFlashcards.forEach(card => card.isFlipped = false);
        
        // Calculate new index
        let newIndex = message.currentCardIndex;
        if (direction === 'next' && newIndex < updatedFlashcards.length - 1) {
          newIndex++;
        } else if (direction === 'prev' && newIndex > 0) {
          newIndex--;
        }
        
        updatedMessages[messageIndex] = {
          ...message,
          flashcards: updatedFlashcards,
          currentCardIndex: newIndex
        };
      }
      
      return updatedMessages;
    });
  };
  
  // Render quiz UI
  const renderQuiz = (message: Message, index: number) => {
    if (!message.quizData) return null;
    
    const quizData = message.quizData;
    
    if (quizData.quizComplete) {
      // Render quiz results
      const score = calculateQuizScore(quizData);
      
      return (
        <div className="quiz-results chat-quiz">
          <div className="score-summary">
            <div className="score-circle">
              <div className="score-percentage">{score.percentage}%</div>
              <div className="score-text">
                {score.correct} of {score.total} correct
              </div>
            </div>
          </div>
          
          <div className="quiz-actions">
            <button onClick={() => restartQuiz(index)}>Restart Quiz</button>
          </div>
        </div>
      );
    }
    
    // Render active quiz question
    const currentQuestion = quizData.questions[quizData.currentQuestionIndex];
    
    return (
      <div className="quiz-active chat-quiz">
        <div className="question-progress">
          Question {quizData.currentQuestionIndex + 1} of {quizData.questions.length}
        </div>
        
        <div className="question-container">
          <div className="question-text">{currentQuestion.question}</div>
          
          <div className="options-list">
            {currentQuestion.options.map((option, optIndex) => (
              <div 
                key={optIndex} 
                className={`option ${quizData.selectedAnswer === optIndex.toString() ? 'selected' : ''} ${
                  quizData.showExplanation && currentQuestion.answer === optIndex ? 'correct' : ''
                } ${quizData.showExplanation && quizData.selectedAnswer === optIndex.toString() && quizData.selectedAnswer !== currentQuestion.answer.toString() ? 'incorrect' : ''}`}
                onClick={() => !quizData.showExplanation && handleAnswerSelect(index, optIndex)}
              >
                {option}
              </div>
            ))}
          </div>
          
          {quizData.showExplanation && (
            <div className="explanation">
              <strong>Explanation:</strong> {currentQuestion.explanation}
            </div>
          )}
        </div>
        
        <div className="question-navigation">
          <button 
            onClick={() => handleNextQuestion(index)} 
            disabled={quizData.selectedAnswer === null}
          >
            {quizData.currentQuestionIndex < quizData.questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
          </button>
        </div>
      </div>
    );
  };

  // Add toggle function
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Add handleOptionClick function for better interaction
  const handleFlashcardClick = () => {
    const newText = "Create flashcards about ";
    setInput(newText);
    // Focus on input and set cursor at the end
    setTimeout(() => {
      const inputElement = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.setSelectionRange(newText.length, newText.length);
      }
    }, 0);
  };

  const handleQuizClick = () => {
    const newText = "Generate a quiz about ";
    setInput(newText);
    // Focus on input and set cursor at the end
    setTimeout(() => {
      const inputElement = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.setSelectionRange(newText.length, newText.length);
      }
    }, 0);
  };

  // External links button handler
  const handleExternalLinksClick = () => {
    const newText = "Find resources about ";
    setInput(newText);
    // Focus on input and set cursor at the end
    setTimeout(() => {
      const inputElement = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.setSelectionRange(newText.length, newText.length);
      }
    }, 0);
  };

  // Render external links
  const renderExternalLinks = (message: Message) => {
    if (!message.externalLinks || message.externalLinks.length === 0) return null;
    
    return (
      <div className="external-links-container">
        {message.externalLinks.map((link, index) => (
          <div key={index} className={`external-link-item ${link.type}`}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-title">
              {link.title}
              {link.type === 'youtube' && <span className="link-icon youtube-icon">📺</span>}
              {link.type === 'website' && <span className="link-icon website-icon">🔗</span>}
            </a>
            {link.description && <p className="link-description">{link.description}</p>}
          </div>
        ))}
      </div>
    );
  };

  // Render suggested topics
  const renderSuggestedTopics = (topics: string[]) => {
    if (!topics || topics.length === 0) return null;
    
    return (
      <div className="suggested-topics">
        <p>Suggested topics:</p>
        <div className="topic-buttons">
          {topics.map((topic, index) => (
            <button 
              key={index} 
              className="topic-button"
              onClick={() => {
                setInput(topic);
                // Small delay to allow state to update before sending
                setTimeout(() => {
                  handleSubmit();
                }, 10);
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Detect if running inside an iframe
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      // If we can't access window.top due to same-origin policy,
      // we're definitely in an iframe
      setIsInIframe(true);
    }
  }, []);

  // Add responsive behavior for iframe
  useEffect(() => {
    if (!isInIframe) return;
    
    // Handle iframe sizing
    const handleResize = () => {
      // You could add specific behavior here if needed
      scrollToBottom();
    };

    window.addEventListener('resize', handleResize);
    
    // Handle messages from parent (Canvas)
    const handleMessage = (event: MessageEvent) => {
      // Process messages from Canvas parent
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'CANVAS_CONTEXT') {
          console.log('Received Canvas context:', event.data.context);
          // You could process Canvas-specific context here
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('message', handleMessage);
    };
  }, [isInIframe]);
  
  // Notify iframe parent when fully loaded
  useEffect(() => {
    if (isInIframe && window.parent) {
      try {
        window.parent.postMessage({ type: 'CHATBOT_READY' }, '*');
      } catch (e) {
        console.error('Failed to communicate with parent frame', e);
      }
    }
  }, [isInIframe]);

  return (
    <div className={`chat-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="chat-header">
        <div className="chat-title">Course Assistant</div>
        <div className="chat-controls">
          <button 
            className="control-button toggle-size-button" 
            onClick={toggleExpanded}
            aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
          >
            {isExpanded ? '⊖' : '⊕'}
          </button>
        </div>
      </div>
      
      {transcriptStats && transcriptStats.count === 0 && (
        <div className="transcript-notice">
          <p>No course materials loaded yet. Answers will be general knowledge until transcripts are processed.</p>
          <button 
            className="process-button" 
            onClick={handleProcessTranscripts}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Process Transcripts'}
          </button>
        </div>
      )}
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role} ${message.isOffTopic ? 'off-topic' : ''} ${(message.isFlashcards || message.isQuiz) ? 'has-special-content' : ''}`}>
            <div className={`message-content ${(message.isFlashcards || message.isQuiz) ? 'special-content' : ''}`}>
              {message.content}
              {message.isTyping && (
                <span className="typing-cursor">|</span>
              )}
            </div>
            {message.isOffTopic && (
              <div className="off-topic-indicator">
                This question is outside the scope of the course materials
                {message.suggestedTopics && message.suggestedTopics.length > 0 && renderSuggestedTopics(message.suggestedTopics)}
              </div>
            )}
            {message.isFlashcards && renderFlashcards(message, index)}
            {message.isQuiz && renderQuiz(message, index)}
            {message.isExternalLinks && renderExternalLinks(message)}
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
          className={`option-button ${isFlashcardRequest(input) ? 'active' : ''}`}
          onClick={handleFlashcardClick}
        >
          Flashcards
        </button>
        <button 
          className={`option-button ${isQuizRequest(input) ? 'active' : ''}`}
          onClick={handleQuizClick}
        >
          Quiz
        </button>
        <button 
          className={`option-button ${isExternalLinkRequest(input) ? 'active' : ''}`}
          onClick={handleExternalLinksClick}
        >
          Resources
        </button>
      </div>
      
      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyDown}
          placeholder="Type your question here..."
          disabled={isLoading}
          rows={1}
        />
        <button 
          className="send-button" 
          onClick={handleButtonClick}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          <span className="send-icon">➤</span>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface; 