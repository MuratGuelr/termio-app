import { useState, useEffect, useRef, useCallback } from 'react';
import './EnhancedPomodoroTimer.css';

const TIMER_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  SETTINGS: 'settings'
};

const TIMER_TYPES = {
  POMODORO: 'pomodoro',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
  CUSTOM: 'custom'
};

const DEFAULT_DURATIONS = {
  pomodoro: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
  custom: 30 * 60
};

export default function EnhancedPomodoroTimer({ task, onTaskComplete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATIONS.pomodoro);
  const [state, setState] = useState(TIMER_STATES.IDLE);
  const [sessions, setSessions] = useState(0);
  const [currentTimerType, setCurrentTimerType] = useState(TIMER_TYPES.POMODORO);
  const [currentTask, setCurrentTask] = useState(null);
  const [settings, setSettings] = useState({
    durations: { ...DEFAULT_DURATIONS },
    autoStartBreaks: true,
    autoStartPomodoros: false,
    soundEnabled: true,
    tickSoundEnabled: false,
    longBreakInterval: 4,
    dailyGoal: 8
  });
  const [todayStats, setTodayStats] = useState({
    completed: 0,
    totalTime: 0,
    breaks: 0
  });
  const intervalRef = useRef(null);
  const audioRefs = useRef({});

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    // Load today's stats
    const today = new Date().toDateString();
    const savedStats = localStorage.getItem(`pomodoroStats_${today}`);
    if (savedStats) {
      setTodayStats(JSON.parse(savedStats));
    }
    
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

  // Mock functions for gamification integration
  const trackPomodoroSession = useCallback(async () => {
    try {
      // This would integrate with your gamification system
      console.log('Pomodoro session tracked');
    } catch (error) {
      console.error('Error tracking pomodoro session:', error);
    }
  }, []);

  const awardXP = useCallback(async (amount, reason) => {
    try {
      // This would integrate with your gamification system
      console.log(`Awarded ${amount} XP for ${reason}`);
    } catch (error) {
      console.error('Error awarding XP:', error);
    }
  }, []);

  const updateTodayStats = useCallback((type, value = 1) => {
    try {
      const today = new Date().toDateString();
      const newStats = { ...todayStats };
      
      if (type === 'completed') {
        newStats.completed += value;
        newStats.totalTime += settings.durations.pomodoro;
      } else if (type === 'breaks') {
        newStats.breaks += value;
      }
      
      setTodayStats(newStats);
      localStorage.setItem(`pomodoroStats_${today}`, JSON.stringify(newStats));
    } catch (error) {
      console.error('Error updating today stats:', error);
    }
  }, [todayStats, settings.durations.pomodoro]);

  const handleTimerComplete = useCallback(async () => {
    try {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (currentTimerType === TIMER_TYPES.POMODORO) {
        // Pomodoro completed
        setSessions(prev => prev + 1);
        await trackPomodoroSession();
        await awardXP(25, 'pomodoro_complete');
        updateTodayStats('completed');
        
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🍅 Pomodoro Tamamlandı!', {
            body: `${sessions + 1}. seans tamamlandı! Mola zamanı.`,
            icon: '/vite.svg'
          });
        }
        
        // Auto-start break if enabled
        if (settings.autoStartBreaks) {
          const isLongBreak = (sessions + 1) % settings.longBreakInterval === 0;
          const breakType = isLongBreak ? TIMER_TYPES.LONG_BREAK : TIMER_TYPES.SHORT_BREAK;
          setCurrentTimerType(breakType);
          setTimeLeft(settings.durations[breakType === TIMER_TYPES.LONG_BREAK ? 'long_break' : 'short_break']);
          setState(TIMER_STATES.RUNNING);
        } else {
          setState(TIMER_STATES.IDLE);
          const isLongBreak = (sessions + 1) % settings.longBreakInterval === 0;
          const breakType = isLongBreak ? TIMER_TYPES.LONG_BREAK : TIMER_TYPES.SHORT_BREAK;
          setCurrentTimerType(breakType);
          setTimeLeft(settings.durations[breakType === TIMER_TYPES.LONG_BREAK ? 'long_break' : 'short_break']);
        }
      } else {
        // Break completed
        updateTodayStats('breaks');
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('☕ Mola Bitti!', {
            body: 'Çalışmaya geri dönme zamanı!',
            icon: '/vite.svg'
          });
        }
        
        // Auto-start pomodoro if enabled
        if (settings.autoStartPomodoros) {
          setCurrentTimerType(TIMER_TYPES.POMODORO);
          setTimeLeft(settings.durations.pomodoro);
          setState(TIMER_STATES.RUNNING);
        } else {
          setState(TIMER_STATES.IDLE);
          setCurrentTimerType(TIMER_TYPES.POMODORO);
          setTimeLeft(settings.durations.pomodoro);
        }
      }
    } catch (error) {
      console.error('Error handling timer completion:', error);
      setState(TIMER_STATES.IDLE);
    }
  }, [currentTimerType, sessions, settings, trackPomodoroSession, awardXP, updateTodayStats]);

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
        intervalRef.current = null;
      }
    };
  }, [state, timeLeft, handleTimerComplete]);

  const startTimer = useCallback((taskToStart = null, timerType = null) => {
    try {
      if (taskToStart) {
        setCurrentTask(taskToStart);
      }
      if (timerType) {
        setCurrentTimerType(timerType);
        const duration = settings.durations[timerType] || settings.durations.pomodoro;
        if (duration > 0) {
          setTimeLeft(duration);
        } else {
          console.error('Invalid timer duration');
          return;
        }
      }
      setState(TIMER_STATES.RUNNING);
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(error => {
          console.error('Error requesting notification permission:', error);
        });
      }
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  }, [settings.durations]);

  const pauseTimer = useCallback(() => {
    try {
      setState(TIMER_STATES.PAUSED);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  }, []);

  const resetTimer = useCallback(() => {
    try {
      setState(TIMER_STATES.IDLE);
      setCurrentTimerType(TIMER_TYPES.POMODORO);
      setTimeLeft(settings.durations.pomodoro);
      setCurrentTask(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (error) {
      console.error('Error resetting timer:', error);
    }
  }, [settings.durations.pomodoro]);

  const skipTimer = useCallback(() => {
    try {
      handleTimerComplete();
    } catch (error) {
      console.error('Error skipping timer:', error);
    }
  }, [handleTimerComplete]);

  const saveSettings = useCallback((newSettings) => {
    try {
      // Validate settings
      if (!newSettings || typeof newSettings !== 'object') {
        console.error('Invalid settings object');
        return;
      }
      
      // Validate durations
      if (newSettings.durations) {
        const { durations } = newSettings;
        if (durations.pomodoro < 60 || durations.pomodoro > 3600) {
          console.error('Invalid pomodoro duration');
          return;
        }
        if (durations.short_break < 60 || durations.short_break > 1800) {
          console.error('Invalid short break duration');
          return;
        }
        if (durations.long_break < 60 || durations.long_break > 3600) {
          console.error('Invalid long break duration');
          return;
        }
      }
      
      setSettings(newSettings);
      localStorage.setItem('pomodoroSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, []);

  const openSettings = useCallback(() => {
    try {
      setState(TIMER_STATES.SETTINGS);
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }, []);

  const closeSettings = useCallback(() => {
    try {
      setState(TIMER_STATES.IDLE);
    } catch (error) {
      console.error('Error closing settings:', error);
    }
  }, []);

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
    const totalDuration = settings.durations[currentTimerType] || settings.durations.pomodoro;
    return ((totalDuration - timeLeft) / totalDuration) * 100;
  };

  const getCurrentTimerLabel = () => {
    switch (currentTimerType) {
      case TIMER_TYPES.POMODORO:
        return 'Pomodoro';
      case TIMER_TYPES.SHORT_BREAK:
        return 'Kısa Mola';
      case TIMER_TYPES.LONG_BREAK:
        return 'Uzun Mola';
      case TIMER_TYPES.CUSTOM:
        return 'Özel Timer';
      default:
        return 'Timer';
    }
  };

  const getTimerColor = () => {
    switch (currentTimerType) {
      case TIMER_TYPES.POMODORO:
        return '#6366f1';
      case TIMER_TYPES.SHORT_BREAK:
        return '#10b981';
      case TIMER_TYPES.LONG_BREAK:
        return '#8b5cf6';
      case TIMER_TYPES.CUSTOM:
        return '#f59e0b';
      default:
        return '#6366f1';
    }
  };

  const toggleExpanded = useCallback(() => {
    try {
      setIsExpanded(!isExpanded);
    } catch (error) {
      console.error('Error toggling expanded state:', error);
    }
  }, [isExpanded]);

  const isActive = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;
  const progressPercentage = getProgressPercentage();
  const timerColor = getTimerColor();

  return (
    <div className={`enhanced-pomodoro ${isExpanded ? 'expanded' : 'minimized'} ${isActive ? 'active' : ''}`}>
      {!isExpanded ? (
        // Minimized view - floating icon
        <div className="floating-icon" onClick={toggleExpanded}>
          <div className="icon-container">
            <i className="fas fa-clock"></i>
            {isActive && (
              <div className="mini-timer">
                <div className="mini-progress" style={{ 
                  background: `conic-gradient(${timerColor} ${progressPercentage * 3.6}deg, rgba(255,255,255,0.2) 0deg)` 
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
        <div className="timer-panel">
          <div className="timer-header">
            <h4>
              <i className={`fas ${currentTimerType === TIMER_TYPES.POMODORO ? 'fa-brain' : 'fa-coffee'}`}></i>
              {getCurrentTimerLabel()}
            </h4>
            <div className="header-controls">
              <button className="settings-btn" onClick={openSettings}>
                <i className="fas fa-cog"></i>
              </button>
              <button className="minimize-btn" onClick={toggleExpanded}>
                <i className="fas fa-minus"></i>
              </button>
            </div>
          </div>

          {currentTask && (
            <div className="current-task">
              <i className="fas fa-target"></i>
              <span>{currentTask.text}</span>
            </div>
          )}

          {state === TIMER_STATES.SETTINGS ? (
            <div className="timer-settings">
              <h5>Timer Ayarları</h5>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Pomodoro (dakika)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={Math.floor(settings.durations.pomodoro / 60)}
                    onChange={(e) => saveSettings({
                      ...settings,
                      durations: { ...settings.durations, pomodoro: parseInt(e.target.value) * 60 }
                    })}
                  />
                </div>
                <div className="setting-item">
                  <label>Kısa Mola (dakika)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="30" 
                    value={Math.floor(settings.durations.short_break / 60)}
                    onChange={(e) => saveSettings({
                      ...settings,
                      durations: { ...settings.durations, short_break: parseInt(e.target.value) * 60 }
                    })}
                  />
                </div>
                <div className="setting-item">
                  <label>Uzun Mola (dakika)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={Math.floor(settings.durations.long_break / 60)}
                    onChange={(e) => saveSettings({
                      ...settings,
                      durations: { ...settings.durations, long_break: parseInt(e.target.value) * 60 }
                    })}
                  />
                </div>
                <div className="setting-item">
                  <label>Günlük Hedef</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={settings.dailyGoal}
                    onChange={(e) => saveSettings({ ...settings, dailyGoal: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="settings-toggles">
                <label className="toggle-item">
                  <input 
                    type="checkbox" 
                    checked={settings.autoStartBreaks}
                    onChange={(e) => saveSettings({ ...settings, autoStartBreaks: e.target.checked })}
                  />
                  <span>Molaları otomatik başlat</span>
                </label>
                <label className="toggle-item">
                  <input 
                    type="checkbox" 
                    checked={settings.autoStartPomodoros}
                    onChange={(e) => saveSettings({ ...settings, autoStartPomodoros: e.target.checked })}
                  />
                  <span>Pomodoroları otomatik başlat</span>
                </label>
                <label className="toggle-item">
                  <input 
                    type="checkbox" 
                    checked={settings.soundEnabled}
                    onChange={(e) => saveSettings({ ...settings, soundEnabled: e.target.checked })}
                  />
                  <span>Ses bildirimleri</span>
                </label>
              </div>
              <button className="close-settings-btn" onClick={closeSettings}>
                <i className="fas fa-check"></i> Kaydet
              </button>
            </div>
          ) : (
            <>
              <div className="timer-display">
                <div className="timer-circle">
                  <svg viewBox="0 0 120 120" className="timer-svg">
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={timerColor} stopOpacity="1" />
                        <stop offset="100%" stopColor={timerColor} stopOpacity="0.6" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge> 
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/> 
                        </feMerge>
                      </filter>
                    </defs>
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="url(#progressGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="314"
                      strokeDashoffset={314 - (314 * progressPercentage) / 100}
                      transform="rotate(-90 60 60)"
                      className="timer-progress"
                      filter="url(#glow)"
                    />
                  </svg>
                  <div className="timer-time">
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>

              <div className="timer-info">
                <div className="stats-row">
                  <div className="stat-item stat-item--completed">
                    <div className="stat-icon">
                      <i className="fas fa-trophy"></i>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{todayStats.completed}</span>
                      <span className="stat-label">Tamamlanan</span>
                    </div>
                  </div>
                  
                  <div className="stat-item stat-item--sessions">
                    <div className="stat-icon">
                      <i className="fas fa-fire"></i>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{sessions}</span>
                      <span className="stat-label">Seans</span>
                    </div>
                  </div>
                  
                  <div className="stat-item stat-item--progress">
                    <div className="stat-icon">
                      <i className="fas fa-target"></i>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{Math.round((todayStats.completed / settings.dailyGoal) * 100)}%</span>
                      <span className="stat-label">İlerleme</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="timer-controls">
                {state === TIMER_STATES.IDLE && (
                  <button onClick={() => startTimer()} className="timer-btn timer-btn--start">
                    <i className="fas fa-play"></i>
                    <span>Başlat</span>
                  </button>
                )}
                
                {state === TIMER_STATES.RUNNING && (
                  <>
                    <button onClick={pauseTimer} className="timer-btn timer-btn--pause">
                      <i className="fas fa-pause"></i>
                      <span>Duraklat</span>
                    </button>
                    <button onClick={skipTimer} className="timer-btn timer-btn--skip">
                      <i className="fas fa-forward"></i>
                      <span>Geç</span>
                    </button>
                  </>
                )}
                
                {state === TIMER_STATES.PAUSED && (
                  <>
                    <button onClick={() => startTimer()} className="timer-btn timer-btn--resume">
                      <i className="fas fa-play"></i>
                      <span>Devam</span>
                    </button>
                    <button onClick={skipTimer} className="timer-btn timer-btn--skip">
                      <i className="fas fa-forward"></i>
                      <span>Geç</span>
                    </button>
                  </>
                )}

                <button onClick={resetTimer} className="timer-btn timer-btn--reset">
                  <i className="fas fa-redo"></i>
                  <span>Sıfırla</span>
                </button>
              </div>

              <div className="quick-timers">
                <button 
                  onClick={() => startTimer(null, TIMER_TYPES.POMODORO)} 
                  className={`quick-timer ${currentTimerType === TIMER_TYPES.POMODORO ? 'active' : ''}`}
                >
                  <i className="fas fa-brain"></i>
                  <span>Pomodoro</span>
                </button>
                <button 
                  onClick={() => startTimer(null, TIMER_TYPES.SHORT_BREAK)} 
                  className={`quick-timer ${currentTimerType === TIMER_TYPES.SHORT_BREAK ? 'active' : ''}`}
                >
                  <i className="fas fa-coffee"></i>
                  <span>Kısa Mola</span>
                </button>
                <button 
                  onClick={() => startTimer(null, TIMER_TYPES.LONG_BREAK)} 
                  className={`quick-timer ${currentTimerType === TIMER_TYPES.LONG_BREAK ? 'active' : ''}`}
                >
                  <i className="fas fa-bed"></i>
                  <span>Uzun Mola</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
