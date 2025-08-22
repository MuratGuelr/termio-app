import { useEffect, useMemo, useRef } from 'react';
import { useGamification } from '../../contexts/GamificationContext';
import './AchievementsModal.css';

export default function AchievementsModal({ open, onClose }) {
  const { achievements, userStats } = useGamification();
  if (!open) return null;

  const owned = new Set(userStats?.achievements || []);
  const cardRef = useRef(null);

  // Focus trap + ESC close
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const focusable = card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const progressFor = useMemo(() => {
    const level = userStats?.level || 1;
    const pomodoros = userStats?.pomodoroSessions || 0;
    const daily = userStats?.streaks?.daily?.current || 0;
    const task = userStats?.streaks?.tasks?.current || 0;
    const habitsMap = userStats?.streaks?.habits || {};
    const bestHabit = Object.values(habitsMap).reduce((m, h) => Math.max(m, h?.current || 0), 0);
    const totalTasks = userStats?.totalTasksCompleted || 0;

    return (id) => {
      switch (id) {
        case 'first_task': return { value: Math.min(totalTasks, 1), target: 1, hint: 'İlk görevi tamamla' };
        case 'task_streak_3': return { value: Math.min(task, 3), target: 3, hint: '3 gün üst üste görev tamamla' };
        case 'task_streak_7': return { value: Math.min(task, 7), target: 7, hint: '7 gün üst üste görev tamamla' };
        case 'habit_streak_7': return { value: Math.min(bestHabit, 7), target: 7, hint: 'Bir alışkanlığı 7 gün sürdür' };
        case 'pomodoro_master': return { value: Math.min(pomodoros, 25), target: 25, hint: '25 pomodoro tamamla' };
        case 'daily_streak_3': return { value: Math.min(daily, 3), target: 3, hint: '3 gün üst üste aktif ol' };
        case 'daily_streak_7': return { value: Math.min(daily, 7), target: 7, hint: '7 gün üst üste aktif ol' };
        case 'daily_streak_30': return { value: Math.min(daily, 30), target: 30, hint: '30 gün üst üste aktif ol' };
        case 'level_5': return { value: Math.min(level, 5), target: 5, hint: 'Seviye 5 ol' };
        case 'level_10': return { value: Math.min(level, 10), target: 10, hint: 'Seviye 10 ol' };
        case 'habit_master': return { value: 0, target: 1, hint: 'Bir günde tüm alışkanlıkları tamamla' };
        case 'perfectionist': return { value: 0, target: 1, hint: 'Bir günde tüm görevleri tamamla' };
        case 'early_bird': return { value: 0, target: 1, hint: '07:00 öncesi bir görev tamamla' };
        case 'night_owl': return { value: 0, target: 1, hint: '22:00 sonrası bir görev tamamla' };
        default: return { value: 0, target: 1, hint: '' };
      }
    };
  }, [userStats]);

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className="achievements-overlay" role="dialog" aria-modal="true" onMouseDown={onOverlayClick}>
      <div className="achievements-card" ref={cardRef}>
        <div className="achievements-header">
          <h2>Başarımlar</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="achievements-grid">
          {Object.values(achievements).map((a) => {
            const unlocked = owned.has(a.id);
            return (
              <div key={a.id} className={`achievement-item ${unlocked ? 'unlocked' : ''}`}>
                <div className="achievement-icon" aria-hidden="true">{a.icon}</div>
                <div className="achievement-meta">
                  <div className="achievement-title">{a.name}</div>
                  <div className="achievement-desc">{a.description}</div>
                </div>
                <div className="achievement-xp">+{a.xp} XP</div>
                {!unlocked && (
                  <div className="achievement-progress" aria-hidden="false">
                    {(() => {
                      const { value, target, hint } = progressFor(a.id);
                      const pct = Math.max(0, Math.min(100, Math.round((value / (target || 1)) * 100)));
                      return (
                        <>
                          <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                            <div className="progress-fill" style={{ width: pct + '%' }} />
                          </div>
                          <div className="progress-hint">{hint} ({value}/{target})</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="achievements-actions">
          <button className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
