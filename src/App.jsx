import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import MobileEditButton from './components/MobileEditButton';
import MobileNav from './components/MobileNav';
import MainContent from './components/MainContent';
import HistoryModal from './components/modals/HistoryModal';
import GoalModal from './components/modals/GoalModal';
import FocusMode from './components/FocusMode';
import CelebrationOverlay from './components/CelebrationOverlay';
import './styles/variables.css';
import './styles/base.css';

function App() {
  const { user, loading } = useAuth();
  const [theme, setTheme] = useState('light');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [focusMode, setFocusMode] = useState({
    active: false,
    task: null,
    duration: 25,
    remainingTime: 0
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    
    // Update theme icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  };

  const openHistory = () => setHistoryOpen(true);
  const closeHistory = () => setHistoryOpen(false);
  const openGoalModal = () => setGoalModalOpen(true);
  const closeGoalModal = () => setGoalModalOpen(false);

  const startFocusMode = (task) => {
    setFocusMode({
      active: true,
      task,
      duration: 25,
      remainingTime: 25 * 60
    });
  };

  const exitFocusMode = () => {
    setFocusMode({
      active: false,
      task: null,
      duration: 25,
      remainingTime: 0
    });
  };

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 4000);
  };

  if (loading) return null;
  if (!user) return <Login />;

  return (
    <div className="app-container active" id="appContainer">
      <Header
        onToggleTheme={toggleTheme}
        onOpenHistory={openHistory}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing(!isEditing)}
      />
      <MobileEditButton
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing(!isEditing)}
      />
      <MobileNav onToggleTheme={toggleTheme} />
      <MainContent 
        onStartFocusMode={startFocusMode}
        onOpenGoalModal={openGoalModal}
        onTriggerCelebration={triggerCelebration}
        isEditing={isEditing}
      />
      <HistoryModal open={historyOpen} onClose={closeHistory} />
      <GoalModal open={goalModalOpen} onClose={closeGoalModal} />
      <FocusMode 
        active={focusMode.active}
        task={focusMode.task}
        duration={focusMode.duration}
        remainingTime={focusMode.remainingTime}
        onExit={exitFocusMode}
      />
      <CelebrationOverlay show={showCelebration} />
    </div>
  );
}

export default App;
