import './SplashScreen.css';

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-container">
        <div className="splash-logo">
          <div className="logo-graphic">
            <div className="logo-gradient"></div>
            <svg viewBox="0 0 100 100" className="logo-icon">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="45" fill="url(#logoGrad)" opacity="0.1" />
              <path d="M 30 50 Q 50 30 70 50 Q 50 70 30 50" fill="none" stroke="url(#logoGrad)" strokeWidth="2" />
              <circle cx="50" cy="50" r="5" fill="url(#logoGrad)" />
            </svg>
          </div>
        </div>
        
        <div className="splash-content">
          <h1 className="splash-title">Tupan</h1>
          <p className="splash-subtitle">Mechatronics Engineering Platform</p>
        </div>

        <div className="splash-loader">
          <div className="loader-spinner"></div>
          <p className="loader-text">Initializing...</p>
        </div>

        <div className="splash-info">
          <p>Loading core modules and WASM backend</p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
