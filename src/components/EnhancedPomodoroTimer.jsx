import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGamification } from '../contexts/GamificationContext.jsx';
import { useNavigate } from 'react-router-dom';
import LevelPlant from './animations/LevelPlant.jsx';
import DecorShopModal from './decor/DecorShopModal.jsx';
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
  const [decorOpen, setDecorOpen] = useState(false);
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
    dailyGoal: 8,
    animationEnabled: true
  });
  const [todayStats, setTodayStats] = useState({
    completed: 0,
    totalTime: 0,
    breaks: 0
  });
  const intervalRef = useRef(null);
  const audioRefs = useRef({});
  const growthCanvasRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [visibilityHidden, setVisibilityHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);
  const { trackPomodoroSession } = useGamification ? useGamification() : { trackPomodoroSession: async () => {} };
  const navigate = useNavigate();

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
      const loadedSettings = JSON.parse(savedSettings);
      // Merge with defaults to ensure new fields exist
      setSettings(prev => ({
        ...prev,
        ...loadedSettings,
        durations: { ...prev.durations, ...(loadedSettings.durations || {}) },
        animationEnabled: loadedSettings.animationEnabled !== undefined ? loadedSettings.animationEnabled : true
      }));
      // Set initial timer duration based on loaded settings
      if (loadedSettings.durations && loadedSettings.durations.pomodoro) {
        setTimeLeft(loadedSettings.durations.pomodoro);
      }
    }
    
    // Load today's stats
    const today = new Date().toDateString();
    const savedStats = localStorage.getItem(`pomodoroStats_${today}`);
    if (savedStats) {
      setTodayStats(JSON.parse(savedStats));
    }
    
    // Respect prefers-reduced-motion
    const mql = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql) {
      const apply = () => setPrefersReducedMotion(!!mql.matches);
      apply();
      mql.addEventListener ? mql.addEventListener('change', apply) : mql.addListener(apply);
    }

    // Track tab visibility to pause animation when hidden
    const onVisibility = () => setVisibilityHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mql) {
        mql.removeEventListener ? mql.removeEventListener('change', () => {}) : mql.removeListener(() => {});
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (task && !currentTask) {
      setCurrentTask(task);
    }
  }, [task, currentTask]);

  // Gamification is provided by context; trackPomodoroSession already awards XP in provider

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
  }, [currentTimerType, sessions, settings, trackPomodoroSession, updateTodayStats]);

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
      
      // Update settings
      setSettings(newSettings);
      localStorage.setItem('pomodoroSettings', JSON.stringify(newSettings));
      
      // Update current timer duration if timer is idle or paused
      if (state === TIMER_STATES.IDLE || state === TIMER_STATES.PAUSED) {
        const newDuration = newSettings.durations[currentTimerType] || newSettings.durations.pomodoro;
        setTimeLeft(newDuration);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [state, currentTimerType]);

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
    return mins > 0 ? `${mins} dk` : `${seconds} sn`;
  };

  const getProgressPercentage = () => {
    const totalDuration = settings.durations[currentTimerType] || settings.durations.pomodoro;
    return ((totalDuration - timeLeft) / totalDuration) * 100;
  };

  const getCurrentLevel = () => {
    // Simple level calculation based on completed sessions
    return Math.floor(Math.sqrt(todayStats.completed * 25 / 100)) + 1;
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
        return 'Özel Zamanlayıcı';
      default:
        return 'Zamanlayıcı';
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

  // SVG plant geometry (deterministic) for 120x120 viewBox
  const svgPlant = useMemo(() => {
    const baseX = 60;
    const groundY = 100;
    const maxStem = 62; // palm is a bit taller
    const count = 44;
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const y = groundY - t * maxStem;
      // more pronounced single-direction sway for palm trunk
      const sway = Math.sin(t * Math.PI * 0.9) * 4 + t * 6;
      const x = baseX + sway * 0.7;
      points.push({ x, y });
    }
    // Approx length using polyline distance
    let approxLen = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      approxLen += Math.hypot(dx, dy);
    }
    // Catmull-Rom to Bezier solver
    const solve = (pts) => {
      const data = [];
      pts.forEach(p => { data.push(p.x, p.y); });
      const size = data.length;
      const last = size - 4;
      let path = `M${data[0]},${data[1]}`;
      for (let i = 0; i < size - 2; i += 2) {
        const x0 = i ? data[i - 2] : data[0];
        const y0 = i ? data[i - 1] : data[1];
        const x1 = data[i + 0];
        const y1 = data[i + 1];
        const x2 = data[i + 2];
        const y2 = data[i + 3];
        const x3 = i !== last ? data[i + 4] : x2;
        const y3 = i !== last ? data[i + 5] : y2;
        const cp1x = (-x0 + 6 * x1 + x2) / 6;
        const cp1y = (-y0 + 6 * y1 + y2) / 6;
        const cp2x = (x1 + 6 * x2 - x3) / 6;
        const cp2y = (y1 + 6 * y2 - y3) / 6;
        path += `C${cp1x},${cp1y},${cp2x},${cp2y},${x2},${y2}`;
      }
      return path;
    };
    const pathD = solve(points);
    // Palm fronds radiating from the crown (top of trunk)
    const crownIdx = points.length - 1;
    const crown = points[crownIdx];
    const below = points[crownIdx - 1];
    const crownAngle = Math.atan2(crown.y - below.y, crown.x - below.x);
    const fronds = [];
    const frondCount = 10;
    for (let i = 0; i < frondCount; i++) {
      const spread = (-Math.PI / 2) + (i / (frondCount - 1)) * (Math.PI * 0.95); // fan
      const angle = crownAngle + spread;
      const length = 22 + (i % 3) * 3;
      const width = 3.5; // visual width of the frond
      const threshold = 0.55 + (i / frondCount) * 0.4; // appear towards later growth
      const endX = crown.x + Math.cos(angle) * length;
      const endY = crown.y + Math.sin(angle) * length;
      fronds.push({
        cx: crown.x,
        cy: crown.y,
        ex: endX,
        ey: endY,
        angle,
        width,
        threshold
      });
    }
    return { pathD, approxLen, fronds, groundY, crown };
  }, [currentTimerType]);

  // Eased growth for smoothness (reused by SVG rendering)
  const growth = useMemo(() => {
    const linear = Math.max(0, Math.min(1, progressPercentage / 100));
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    return easeInOutCubic(linear);
  }, [progressPercentage]);

  // Do not grow during breaks
  const displayedGrowth = useMemo(() => (
    currentTimerType === TIMER_TYPES.POMODORO ? growth : 0
  ), [currentTimerType, growth]);

  // Draw a simple seed-to-tree growth animation on canvas based on progress (kept for backward compat; no canvas rendered now)
  useEffect(() => {
    const canvas = growthCanvasRef.current;
    if (!canvas) return;
    // Skip drawing if animation disabled, reduced motion preferred, or tab hidden
    if (!settings.animationEnabled || prefersReducedMotion || visibilityHidden) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const cssSize = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 140, height: 140 };
        ctx.clearRect(0, 0, cssSize.width, cssSize.height);
      }
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 140, height: 140 };
    const width = Math.floor(cssSize.width);
    const height = Math.floor(cssSize.height);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Easing for smoother perceived growth
    const linear = Math.max(0, Math.min(1, progressPercentage / 100));
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const progress = easeInOutCubic(linear);

    // Ground with subtle radial gradient for 3D feel
    const groundY = height * 0.85;
    const rx = width * 0.35;
    const ry = height * 0.08;
    const grad = ctx.createRadialGradient(width / 2, groundY - ry * 0.3, ry * 0.2, width / 2, groundY, rx);
    grad.addColorStop(0, 'rgba(16,185,129,0.35)');
    grad.addColorStop(1, 'rgba(16,185,129,0.10)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(width / 2, groundY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Soft shadow under ellipse
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.filter = 'blur(2px)';
    ctx.beginPath();
    ctx.ellipse(width / 2, groundY + 2, rx * 0.95, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();

    // Mini timer badge ON the ground ellipse edge (right side)
    const miniR = Math.max(8, Math.min(12, width * 0.1));
    const theta = Math.PI * 0.15; // ~15 degrees above the rightmost point
    const miniCx = width / 2 + rx * Math.cos(theta);
    const miniCy = groundY + ry * Math.sin(theta) - miniR * 0.2; // slight lift so it sits on the rim
    // background ring
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(miniCx, miniCy, miniR, 0, Math.PI * 2);
    ctx.stroke();
    // progress arc
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = timerColor;
    const startAng = -Math.PI / 2;
    const endAng = startAng + progress * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(miniCx, miniCy, miniR, startAng, endAng);
    ctx.stroke();
    // center dot
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(miniCx, miniCy, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Seed shrinking as it grows
    const seedSize = 6 * (1 - progress * 0.9);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.beginPath();
    ctx.arc(width / 2, groundY - 2, Math.max(1.5, seedSize), 0, Math.PI * 2);
    ctx.fill();

    // Trunk/stem grows upward with subtle curvature
    const maxStem = height * 0.55;
    const stemHeight = maxStem * progress;
    const trunkWidth = Math.max(2, 2 + progress * 3);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = trunkWidth;
    ctx.lineCap = 'round';
    const baseX = width / 2;
    const baseY = groundY - 4;
    const topX = baseX + (progress - 0.5) * 6; // slight drift to the right as it grows
    const topY = baseY - stemHeight;
    const cx1 = baseX + 6 * (1 - Math.abs(progress - 0.5) * 2); // reduce curvature near ends
    const cy1 = baseY - stemHeight * 0.5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(cx1, cy1, topX, topY);
    ctx.stroke();

    // Simple branches when > 30% with slight angles
    if (progress > 0.3) {
      const branchBaseY = baseY - stemHeight * 0.6;
      ctx.lineWidth = Math.max(1.2, trunkWidth * 0.6);
      ctx.beginPath();
      ctx.moveTo(topX - 2, branchBaseY);
      ctx.lineTo(topX - 16 * progress, branchBaseY - 10 * progress);
      ctx.moveTo(topX + 2, branchBaseY);
      ctx.lineTo(topX + 16 * progress, branchBaseY - 10 * progress);
      ctx.stroke();
    }

    // Leaves cluster towards the top, denser as progress increases (deterministic positions for smoothness)
    const leafCount = Math.floor(6 + progress * 14);
    const crownCenterY = baseY - stemHeight;
    const rand = (seed) => {
      const x = Math.sin(seed * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < leafCount; i++) {
      const t = i + 1;
      const angle = (t / leafCount) * Math.PI * 2;
      const jitterR = 0.6 + 0.4 * rand(t * 3.3);
      const jitterA = angle + (rand(t * 5.7) - 0.5) * 0.2;
      const radius = 8 + progress * 16; // crown radius grows with progress
      const lx = width / 2 + Math.cos(jitterA) * radius * jitterR;
      const ly = crownCenterY + Math.sin(jitterA) * radius * (0.5 + 0.5 * rand(t * 7.9));
      const leafSize = 2 + progress * 2.6;
      ctx.fillStyle = progress < 0.5 ? '#34d399' : '#10b981';
      ctx.beginPath();
      ctx.ellipse(lx, ly, leafSize, leafSize * 0.7, jitterA, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [progressPercentage, currentTimerType, settings.animationEnabled, prefersReducedMotion, visibilityHidden, timerColor]);

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
              <button className="decor-btn" onClick={() => navigate('/decor')} aria-label="Dekor stüdyosunu aç">
                <i className="fas fa-gamepad"></i>
              </button>
              <button className="settings-btn" onClick={openSettings} aria-label="Ayarları aç">
                <i className="fas fa-cog"></i>
              </button>
              <button className="minimize-btn" onClick={toggleExpanded} aria-label="Zamanlayıcıyı küçült">
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
              <h5>Zamanlayıcı Ayarları</h5>
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
                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={settings.animationEnabled && !prefersReducedMotion}
                    onChange={(e) => saveSettings({ ...settings, animationEnabled: e.target.checked })}
                    disabled={prefersReducedMotion}
                  />
                  <span>Tohum-ağaç animasyonu {prefersReducedMotion ? '(sistem tercihi: azaltılmış hareket)' : ''}</span>
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
                  {/* SVG Plant Animation (no external libs) */}
                  {settings.animationEnabled && !prefersReducedMotion && !visibilityHidden && (
                    <LevelPlant
                      level={getCurrentLevel()}
                      growth={displayedGrowth}
                      miniProgress={Math.max(0, Math.min(1, progressPercentage/100))}
                      timerColor={timerColor}
                    />
                  )}
                  <svg viewBox="0 0 120 120" className="timer-svg" aria-hidden="true" focusable="false">
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
                  <div className="timer-time" role="timer" aria-live="polite" aria-atomic="true">
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>

              <div className="timer-info">
                <div className="stats-positioned">
                  <div className="stat-corner stat-corner--left">
                    <i className="fas fa-fire"></i>
                    <span>{sessions} Seans</span>
                  </div>
                  <div className="stat-corner stat-corner--right">
                    <i className="fas fa-trophy"></i>
                    <span>{todayStats.completed} Tamamlanan</span>
                  </div>
                </div>
                <div className="level-indicator">
                  <i className="fas fa-star"></i>
                  <span>Seviye {Math.floor(Math.sqrt(todayStats.completed * 25 / 100)) + 1}</span>
                </div>
              </div>

              <div className="timer-controls">
                {state === TIMER_STATES.IDLE && (
                  <button onClick={() => startTimer()} className="timer-btn timer-btn--start" aria-label="Zamanlayıcıyı başlat">
                    <i className="fas fa-play"></i>
                    <span>Başlat</span>
                  </button>
                )}
                
                {state === TIMER_STATES.RUNNING && (
                  <>
                    <button onClick={pauseTimer} className="timer-btn timer-btn--pause" aria-label="Duraklat">
                      <i className="fas fa-pause"></i>
                      <span>Duraklat</span>
                    </button>
                    <button onClick={skipTimer} className="timer-btn timer-btn--skip" aria-label="Atla">
                      <i className="fas fa-forward"></i>
                      <span>Atla</span>
                    </button>
                  </>
                )}
                
                {state === TIMER_STATES.PAUSED && (
                  <>
                    <button onClick={() => startTimer()} className="timer-btn timer-btn--resume" aria-label="Devam et">
                      <i className="fas fa-play"></i>
                      <span>Devam Et</span>
                    </button>
                    <button onClick={skipTimer} className="timer-btn timer-btn--skip" aria-label="Atla">
                      <i className="fas fa-forward"></i>
                      <span>Atla</span>
                    </button>
                  </>
                )}

                <button onClick={resetTimer} className="timer-btn timer-btn--reset" aria-label="Sıfırla">
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
          <DecorShopModal open={decorOpen} onClose={() => setDecorOpen(false)} />
        </div>
      )}
    </div>
  );
}
