import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Presentation from './components/Presentation';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminConsole from './components/AdminConsole';

const SCREENS = { PRESENTATION: 'PRESENTATION', LOGIN: 'LOGIN', DASHBOARD: 'DASHBOARD' };

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050810] text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl mb-4">Application Error</p>
            <p className="text-sm text-gray-400 mb-6">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.PRESENTATION);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('zyrosafe.session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setUserProfile(parsed);
          setScreen(SCREENS.DASHBOARD);
        }
      }
    } catch (err) {
      console.warn('Failed to restore local session:', err.message);
    }
  }, []);

  const goToLogin = useCallback(() => setScreen(SCREENS.LOGIN), []);
  const handleLogin = useCallback((data) => {
    setUserProfile(data);
    try {
      localStorage.setItem('zyrosafe.session', JSON.stringify(data));
    } catch {
      // Ignore storage failures.
    }
    setScreen(SCREENS.DASHBOARD);
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('zyrosafe.session');
    } catch {
      // Ignore storage failures.
    }
    setScreen(SCREENS.PRESENTATION);
    setUserProfile(null);
  }, []);

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen overflow-hidden bg-[#050810] text-white font-body">
        <AnimatePresence mode="wait">
          {screen === SCREENS.PRESENTATION && (
            <motion.div
              key="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="h-full w-full"
            >
              <Presentation onComplete={goToLogin} />
            </motion.div>
          )}

          {screen === SCREENS.LOGIN && (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="h-full w-full"
            >
              <Login onLogin={handleLogin} />
            </motion.div>
          )}

          {screen === SCREENS.DASHBOARD && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="h-full w-full"
            >
              {String(userProfile?.role || '').toLowerCase() === 'admin' ? (
                <AdminConsole userProfile={userProfile} onLogout={handleLogout} />
              ) : (
                <Dashboard userProfile={userProfile} onLogout={handleLogout} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
