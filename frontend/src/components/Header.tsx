import React from 'react';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  return (
    <header className="header">
      <button className="menu-button" onClick={toggleSidebar}>
        ☰
      </button>
      <h1 className="header-title">Cardiopulmonary Course Assistant</h1>
      <div></div> {/* Empty div for flex spacing */}
    </header>
  );
};

export default Header; 