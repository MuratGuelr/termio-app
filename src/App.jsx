import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import Login from './components/Login';
import Header from './components/Header';
import SettingsModal from './components/modals/SettingsModal';
import MobileEditButton from './components/MobileEditButton';
import MobileNav from './components/MobileNav';
import MainContent from './components/MainContent';
import HistoryModal from './components/modals/HistoryModal';
import GoalModal from './components/modals/GoalModal';
import FocusMode from './components/FocusMode';
import CelebrationOverlay from './components/CelebrationOverlay';
import Onboarding from './components/Onboarding';
import OnboardingMobile from './components/OnboardingMobile';
import EnhancedPomodoroTimer from './components/EnhancedPomodoroTimer';
import './styles/variables.css';
import './styles/base.css';

function App() {
  const { user, loading } = useAuth();
  const [theme, setTheme] = useState('light');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState({
    active: false,
    task: null,
    duration: 25,
    remainingTime: 0
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tutorialLoaded, setTutorialLoaded] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load per-user tutorial status
  useEffect(() => {
    const loadTutorial = async () => {
      if (!user) return;
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setTutorialCompleted(!!data.completed);
        } else {
          // first login, initialize tutorial state as not completed
          await setDoc(ref, { completed: false, step: 0 });
          setTutorialCompleted(false);
        }
      } catch (e) {
        console.error('Failed to load tutorial status', e);
        // Fail-safe: allow app usage if something goes wrong
        setTutorialCompleted(true);
      } finally {
        setTutorialLoaded(true);
      }
    };
    if (user) {
      setTutorialLoaded(false);
      loadTutorial();
    }
  }, [user]);

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
  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);

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
  if (!tutorialLoaded) return null;

  return (
    <div className="app-container active" id="appContainer">
      <Header
        onToggleTheme={toggleTheme}
        onOpenHistory={openHistory}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onOpenSettings={openSettings}
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
      <SettingsModal
        open={settingsOpen}
        onClose={closeSettings}
        onToggleTheme={toggleTheme}
        currentTheme={theme}
      />
      <FocusMode 
        active={focusMode.active}
        task={focusMode.task}
        duration={focusMode.duration}
        remainingTime={focusMode.remainingTime}
        onExit={exitFocusMode}
      />
      <CelebrationOverlay show={showCelebration} />
      <EnhancedPomodoroTimer />
      {!tutorialCompleted && (
        // TEMP: force mobile tutorial for all screen sizes to validate phone flow
        <OnboardingMobile onComplete={() => setTutorialCompleted(true)} />
      )}
    </div>
  );
}

export default App;
