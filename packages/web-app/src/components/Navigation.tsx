/**
 * Main Navigation Component
 *
 * Header with navigation menu and theme toggle
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navigation.css';

interface NavigationProps {
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ theme, onThemeToggle }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Block Diagram', path: '/block-diagram' },
    { label: 'State Machine', path: '/state-machine' },
    { label: 'Petri Net', path: '/petri-net' },
    { label: 'LaTeX', path: '/latex' },
    { label: 'Circuits', path: '/circuit-electrical' },
    { label: 'Thermal', path: '/circuit-thermal' },
  ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <span className="nav-logo-icon">⚙️</span>
          <span className="nav-logo-text">Tupan</span>
        </Link>

        <div className="nav-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}></span>
        </div>

        <ul className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
          {menuItems.map(item => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <button
            className="nav-theme-toggle"
            onClick={onThemeToggle}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </nav>
  );
};
