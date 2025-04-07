import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// We'll add the Flashcards and Quiz components later

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState('chat');

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Router>
      <div className="app">
        <Header toggleSidebar={toggleSidebar} />
        <div className="content-wrapper">
          <Sidebar 
            isOpen={isSidebarOpen} 
            activeFeature={activeFeature}
            setActiveFeature={setActiveFeature}
          />
          <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            <Routes>
              <Route path="/" element={<ChatInterface />} />
              <Route path="/flashcards" element={<div>Flashcards Coming Soon</div>} />
              <Route path="/quiz" element={<div>Quiz Coming Soon</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
