import { useState, useEffect } from 'react';
import './FocusMode.css';

export default function FocusMode({ active, task, duration, onExit }) {
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (active) {
      setTimeLeft(duration * 60);
      setIsRunning(true);
    }
  }, [active, duration]);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      // Timer completed - could add notification here
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!active) return null;

  return (
    <div className="focus-mode active" id="focusModeOverlay">
      <h2 id="focusModeTitle">Odaklanma Zamanı!</h2>
      <div className="timer" id="focusTimerDisplay">
        {formatTime(timeLeft)}
      </div>
      <p className="task-in-focus" id="focusTaskName">
        {task?.activity || 'Görev'}
      </p>
      <button onClick={onExit}>Odaklanmayı Bitir</button>
    </div>
  );
}
