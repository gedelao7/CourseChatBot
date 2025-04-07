import React from 'react';
import { Link } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  activeFeature: string;
  setActiveFeature: (feature: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, activeFeature, setActiveFeature }) => {
  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <nav className="sidebar-nav">
        <Link 
          to="/" 
          className={`nav-item ${activeFeature === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveFeature('chat')}
        >
          <span className="nav-icon">💬</span>
          Chat
        </Link>
        <Link 
          to="/flashcards" 
          className={`nav-item ${activeFeature === 'flashcards' ? 'active' : ''}`}
          onClick={() => setActiveFeature('flashcards')}
        >
          <span className="nav-icon">🔄</span>
          Flashcards
        </Link>
        <Link 
          to="/quiz" 
          className={`nav-item ${activeFeature === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveFeature('quiz')}
        >
          <span className="nav-icon">❓</span>
          Quiz
        </Link>
      </nav>
    </div>
  );
};

export default Sidebar; 