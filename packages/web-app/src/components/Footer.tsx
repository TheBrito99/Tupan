/**
 * Footer Component
 */

import React from 'react';
import '../styles/Footer.css';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About Tupan</h4>
            <p>Comprehensive mechatronics engineering platform for simulation and design</p>
          </div>

          <div className="footer-section">
            <h4>Features</h4>
            <ul>
              <li><a href="/">Block Diagrams</a></li>
              <li><a href="/">State Machines</a></li>
              <li><a href="/">Petri Nets</a></li>
              <li><a href="/">Circuit Simulation</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><a href="/">Documentation</a></li>
              <li><a href="/">API Reference</a></li>
              <li><a href="/">Examples</a></li>
              <li><a href="/">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} Tupan Project. All rights reserved.</p>
          <p>Version 0.2.0 - Early Development</p>
        </div>
      </div>
    </footer>
  );
};
