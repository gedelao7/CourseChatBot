import React, { useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';

function App() {
  // Handle iframe messaging (for future Canvas integration)
  useEffect(() => {
    // Listen for messages from the parent window (Canvas)
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from trusted domains
      const trustedDomains = [
        'localhost',
        'instructure.com',
        'canvas.net',
        'canvaslms.com'
      ];
      
      const isDomainTrusted = trustedDomains.some(domain => 
        event.origin.includes(domain)
      );
      
      if (!isDomainTrusted) return;
      
      // Process messages from parent
      // This can be expanded in the future to handle auth tokens, course context, etc.
      if (event.data && event.data.type === 'CANVAS_INIT') {
        console.log('Received initialization from Canvas:', event.data);
        // You could store Canvas context here
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Notify the parent window that the app is ready
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'CHATBOT_READY' }, '*');
      } catch (e) {
        console.log('Failed to send ready message to parent');
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="app">
      <main className="main-content">
        <ChatInterface />
      </main>
    </div>
  );
}

export default App;
