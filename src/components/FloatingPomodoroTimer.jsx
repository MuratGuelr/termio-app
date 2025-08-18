import { useState, useEffect, useRef } from 'react';
import './FloatingPomodoroTimer.css';
import { useGamification } from '../contexts/GamificationContext';

const TIMER_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  BREAK: 'break'
};

const POMODORO_DURATION = 25 * 60; // 25 minutes
const SHORT_BREAK_DURATION = 5 * 60; // 5 minutes
const LONG_BREAK_DURATION = 15 * 60; // 15 minutes

export default function FloatingPomodoroTimer({ task, onTaskComplete }) {
  const { trackPomodoroSession, awardXP } = useGamification();
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [state, setState] = useState(TIMER_STATES.IDLE);
  const [sessions, setSessions] = useState(0);
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio for notifications
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQdBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU8k9n1unEiBC13yO/eizEIHWq+8+OWT');
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (task && !currentTask) {
      setCurrentTask(task);
    }
  }, [task, currentTask]);

  useEffect(() => {
    if (state === TIMER_STATES.RUNNING && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, timeLeft]);

  const handleTimerComplete = async () => {
    setState(TIMER_STATES.IDLE);
    
    // Play notification sound
    if (audioRef.current) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }

    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(isBreakTime ? 'Mola Bitti!' : 'Pomodoro Tamamlandı!', {
        body: isBreakTime ? 'Çalışmaya geri dön!' : 'Mola zamanı!',
        icon: '/vite.svg'
      });
    }

    if (!isBreakTime) {
      // Pomodoro session completed
      setSessions(prev => prev + 1);
      await trackPomodoroSession();
      await awardXP(25, 'pomodoro_complete');
      
      // Start break
      setIsBreakTime(true);
      const breakDuration = (sessions + 1) % 4 === 0 ? LONG_BREAK_DURATION : SHORT_BREAK_DURATION;
      setTimeLeft(breakDuration);
      setState(TIMER_STATES.BREAK);
    } else {
      // Break completed
      setIsBreakTime(false);
      setTimeLeft(POMODORO_DURATION);
    }
  };

  const startTimer = (taskToStart = null) => {
    if (taskToStart) {
      setCurrentTask(taskToStart);
    }
    setState(TIMER_STATES.RUNNING);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const pauseTimer = () => {
    setState(TIMER_STATES.PAUSED);
  };

  const resetTimer = () => {
    setState(TIMER_STATES.IDLE);
    setIsBreakTime(false);
    setTimeLeft(POMODORO_DURATION);
    setCurrentTask(null);
  };

  const skipBreak = () => {
    if (isBreakTime) {
      setIsBreakTime(false);
      setTimeLeft(POMODORO_DURATION);
      setState(TIMER_STATES.IDLE);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return mins > 0 ? `${mins}m` : `${seconds}s`;
  };

  const getProgressPercentage = () => {
    const totalDuration = isBreakTime 
      ? (sessions % 4 === 0 ? LONG_BREAK_DURATION : SHORT_BREAK_DURATION)
      : POMODORO_DURATION;
    return ((totalDuration - timeLeft) / totalDuration) * 100;
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const isActive = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED || state === TIMER_STATES.BREAK;

  return (
    <div className={`floating-pomodoro ${isExpanded ? 'expanded' : 'minimized'} ${isActive ? 'active' : ''}`}>
      {!isExpanded ? (
        // Minimized view - floating icon
        <div className="floating-icon" onClick={toggleExpanded}>
          <div className="icon-container">
            <i className="fas fa-clock"></i>
            {isActive && (
              <div className="mini-timer">
                <div className="mini-progress" style={{ 
                  background: `conic-gradient(${isBreakTime ? '#10b981' : '#6366f1'} ${getProgressPercentage() * 3.6}deg, #e5e7eb 0deg)` 
                }}>
                  <span className="mini-time">{formatTimeShort(timeLeft)}</span>
                </div>
              </div>
            )}
            {sessions > 0 && (
              <div className="session-badge">{sessions}</div>
            )}
          </div>
        </div>
      ) : (
        // Expanded view - full timer
        <div className="floating-timer-panel">
          <div className="timer-header">
            <h4>
              <i className="fas fa-clock"></i>
              {isBreakTime ? 'Mola Zamanı' : 'Pomodoro Timer'}
            </h4>
            <button className="minimize-btn" onClick={toggleExpanded}>
              <i className="fas fa-minus"></i>
            </button>
          </div>

          {currentTask && (
            <div className="current-task">
              <i className="fas fa-target"></i>
              <span>{currentTask.text}</span>
            </div>
          )}

          <div className="timer-display">
            <div className="timer-circle">
              <svg viewBox="0 0 100 100" className="timer-svg">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--border-color)"
                  strokeWidth="2"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={isBreakTime ? "var(--success)" : "var(--primary)"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * getProgressPercentage()) / 100}
                  transform="rotate(-90 50 50)"
                  className="timer-progress"
                />
              </svg>
              <div className="timer-time">
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="timer-info">
            <div className="session-counter">
              <i className="fas fa-trophy"></i>
              <span>{sessions}</span>
            </div>
            <div className="timer-phase">
              {isBreakTime ? (
                <span className="break-indicator">
                  <i className="fas fa-coffee"></i>
                  {sessions % 4 === 0 ? 'Uzun Mola' : 'Kısa Mola'}
                </span>
              ) : (
                <span className="work-indicator">
                  <i className="fas fa-brain"></i>
                  Odaklanma
                </span>
              )}
            </div>
          </div>

          <div className="timer-controls">
            {state === TIMER_STATES.IDLE && (
              <button onClick={() => startTimer()} className="timer-btn timer-btn--start">
                <i className="fas fa-play"></i>
              </button>
            )}
            
            {state === TIMER_STATES.RUNNING && (
              <button onClick={pauseTimer} className="timer-btn timer-btn--pause">
                <i className="fas fa-pause"></i>
              </button>
            )}
            
            {state === TIMER_STATES.PAUSED && (
              <button onClick={() => startTimer()} className="timer-btn timer-btn--resume">
                <i className="fas fa-play"></i>
              </button>
            )}

            {state === TIMER_STATES.BREAK && (
              <button onClick={skipBreak} className="timer-btn timer-btn--skip">
                <i className="fas fa-forward"></i>
              </button>
            )}

            <button onClick={resetTimer} className="timer-btn timer-btn--reset">
              <i className="fas fa-redo"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
