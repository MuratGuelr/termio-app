import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';
import './DailyHabits.css';

const defaultHabits = [
  { name: 'Sabah Hareketi', emoji: '🏃', id: 'exercise', streak: 0 },
  { name: 'İngilizce Pratiği', emoji: '🗣️', id: 'english', streak: 0 },
  { name: 'Şınav & Mekik', emoji: '💪', id: 'workout', streak: 0 },
  { name: 'Düzenli Okuma', emoji: '📚', id: 'reading', streak: 0 }
];

// Helpers for day-based habits - Turkish week starts from Monday
const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const trDayFull = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};
const getTodayDayKey = () => {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const turkishDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to Turkish week (0=Monday, 6=Sunday)
  return dayKeys[turkishDayIndex];
};
const makeWeekFrom = (arr) => {
  const clone = (a) => (Array.isArray(a) ? a.map(h => ({ ...h })) : []);
  return {
    monday: clone(arr),
    tuesday: clone(arr),
    wednesday: clone(arr),
    thursday: clone(arr),
    friday: clone(arr),
    saturday: clone(arr),
    sunday: clone(arr),
  };
};

export default function DailyHabits({ completedHabits, onToggleHabit, isEditing, selectedDay }) {
  const { user } = useAuth();
  const { userStats } = useGamification();
  const [habitsByDay, setHabitsByDay] = useState(makeWeekFrom(defaultHabits));
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [tempEmoji, setTempEmoji] = useState(null); // temporary selection before save

  // Curated emoji list for habits (stable, no external UI dependency)
  const emojiList = [
    '🏃','💪','📚','🗣️','💧','🧘','🎯','✍️','🎵','🍎','🌱','⭐','🔥','💡','🎨','🏆',
    '☕','🧠','🧹','🛏️','🧴','🚿','🦷','🥗','🥛','🚰','🚶','🧎','🖊️','📝','🧩','🧘‍♂️',
    '📖','🗓️','⏰','📵','📱','💤','🛒','🧺','🧾','💻','📈','🧑‍🍳','🍽️','🥦','🍋','🥕'
  ];

  // Close picker on Escape
  useEffect(() => {
    if (!showEmojiPicker) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowEmojiPicker(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showEmojiPicker]);

  // Lock background scroll and ensure top stacking when modal is open
  useEffect(() => {
    if (showEmojiPicker) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showEmojiPicker]);

  // No popover logic needed for centered modal

  useEffect(() => {
    if (user) {
      loadUserHabits();
    }
  }, [user]);

  const loadUserHabits = async () => {
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'habits');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.habitsByDay && typeof data.habitsByDay === 'object') {
          setHabitsByDay({ ...makeWeekFrom([]), ...data.habitsByDay });
        } else {
          const base = Array.isArray(data.habits) && data.habits.length > 0 ? data.habits : defaultHabits;
          const week = makeWeekFrom(base);
          setHabitsByDay(week);
          await saveUserHabits(week); // migrate
        }
      } else {
        const week = makeWeekFrom(defaultHabits);
        setHabitsByDay(week);
        await saveUserHabits(week);
      }
    } catch (error) {
      console.error('Error loading habits:', error);
      const week = makeWeekFrom(defaultHabits);
      setHabitsByDay(week);
    }
    setLoading(false);
  };

  const saveUserHabits = async (weekToSave) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'habits');
      await setDoc(docRef, { habitsByDay: weekToSave }, { merge: true });
    } catch (error) {
      console.error('Error saving habits:', error);
    }
  };

  const handleHabitEdit = (habitId, field, value) => {
    const dayHabits = habitsByDay[selectedDay] || [];
    const updatedHabits = dayHabits.map(habit => 
      habit.id === habitId ? { ...habit, [field]: value } : habit
    );
    const updatedWeek = { ...habitsByDay, [selectedDay]: updatedHabits };
    setHabitsByDay(updatedWeek);
  };

  const handleHabitBlur = () => {
    saveUserHabits(habitsByDay);
  };

  const addHabit = () => {
    const newHabit = {
      id: `habit-${Date.now()}`,
      name: 'Yeni Alışkanlık',
      emoji: '⭐',
      streak: 0
    };
    const dayHabits = habitsByDay[selectedDay] || [];
    const updatedHabits = [...dayHabits, newHabit];
    const updatedWeek = { ...habitsByDay, [selectedDay]: updatedHabits };
    setHabitsByDay(updatedWeek);
    saveUserHabits(updatedWeek);
  };

  const removeHabit = (habitId) => {
    const dayHabits = habitsByDay[selectedDay] || [];
    const updatedHabits = dayHabits.filter(habit => habit.id !== habitId);
    const updatedWeek = { ...habitsByDay, [selectedDay]: updatedHabits };
    setHabitsByDay(updatedWeek);
    saveUserHabits(updatedWeek);
  };

  const onEmojiSelectTemp = (emoji) => {
    setTempEmoji(emoji);
  };

  const applyEmojiChange = () => {
    if (!showEmojiPicker || !tempEmoji) { setShowEmojiPicker(null); return; }
    const habitId = showEmojiPicker;
    const dayHabits = habitsByDay[selectedDay] || [];
    const updated = dayHabits.map(habit => habit.id === habitId ? { ...habit, emoji: tempEmoji } : habit);
    const updatedWeek = { ...habitsByDay, [selectedDay]: updated };
    setHabitsByDay(updatedWeek);
    setShowEmojiPicker(null);
    setPickerKey(prev => prev + 1);
    saveUserHabits(updatedWeek);
  };

  const moveHabit = (habitId, direction) => {
    const dayHabits = habitsByDay[selectedDay] || [];
    const currentIndex = dayHabits.findIndex(habit => habit.id === habitId);
    const newIndex = currentIndex + direction;
    
    if (newIndex < 0 || newIndex >= dayHabits.length) return;
    
    const updatedHabits = [...dayHabits];
    const [movedHabit] = updatedHabits.splice(currentIndex, 1);
    updatedHabits.splice(newIndex, 0, movedHabit);
    
    const updatedWeek = { ...habitsByDay, [selectedDay]: updatedHabits };
    setHabitsByDay(updatedWeek);
    saveUserHabits(updatedWeek);
  };
  const habits = useMemo(() => habitsByDay[selectedDay] || [], [habitsByDay, selectedDay]);
  const isTodaySelected = useMemo(() => selectedDay === getTodayDayKey(), [selectedDay]);
  const progress = useMemo(() => {
    const total = habits.length || 1;
    const completed = isTodaySelected ? completedHabits.size : 0;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [completedHabits, habits.length, isTodaySelected]);

  const handleHabitClick = (habitId) => {
    if (isEditing) return;
    if (!isTodaySelected) return; // sadece bugünün listesinde tamamlanma işaretlenebilir
    const isCompleted = completedHabits.has(habitId);
    onToggleHabit(habitId, !isCompleted);
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="card" id="habitsSection">
      <div className="card-header">
        <h3>
          <i className="fas fa-star"></i>
          Alışkanlıklar
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="selected-day-label" style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>{trDayFull[selectedDay]}</span>
          {isEditing && (
            <button className="add-btn" onClick={addHabit}>
              <i className="fas fa-plus"></i>
            </button>
          )}
        </div>
      </div>
      
      <div className="progress-container">
        <div className="progress-label">
          <span>Tamamlanan</span>
          <span id="habitProgress">{progress.completed}/{progress.total}</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            id="habitProgressBar" 
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>

      <ul className="habit-list" id="habitList">
        {habits.map((habit, index) => {
          const isCompleted = completedHabits.has(habit.id);
          return (
            <li 
              key={habit.id}
              className={`habit-item ${isCompleted ? 'completed' : ''} ${isEditing ? 'editing' : ''}`}
              onClick={() => handleHabitClick(habit.id)}
            >
              {isEditing && (
                <div className="habit-controls">
                  <button className="item-reorder" onClick={(e) => { e.stopPropagation(); moveHabit(habit.id, -1); }} disabled={index === 0}>
                    <i className="fas fa-chevron-up"></i>
                  </button>
                  <button className="item-reorder" onClick={(e) => { e.stopPropagation(); moveHabit(habit.id, 1); }} disabled={index === habits.length - 1}>
                    <i className="fas fa-chevron-down"></i>
                  </button>
                </div>
              )}
              
              <div className="habit-checkbox">
                {isCompleted && <i className="fas fa-check"></i>}
              </div>
              
              {isEditing ? (
                <button
                  className="inline-edit emoji-input"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(habit.id);
                    setTempEmoji(habit.emoji);
                  }}
                >
                  {habit.emoji}
                </button>
              ) : (
                <span className="habit-emoji">{habit.emoji}</span>
              )}
              
              {isEditing ? (
                <input
                  type="text"
                  className="inline-edit habit-input"
                  value={habit.name}
                  onChange={(e) => handleHabitEdit(habit.id, 'name', e.target.value)}
                  onBlur={handleHabitBlur}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="habit-name">{habit.name}</div>
              )}
              
              {(() => {
                // 02:00 TRT cutoff: subtract 2 hours for day keys
                const base = new Date();
                base.setHours(base.getHours() - 2);
                const todayKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
                const y = new Date(base); y.setDate(y.getDate() - 1);
                const yesterdayKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
                const s = userStats?.streaks?.habits?.[habit.id];
                let display = 0;
                if (s?.lastCompletionDate === todayKey || s?.lastCompletionDate === yesterdayKey) {
                  display = s.current || 0;
                }
                return (
                  <div className="habit-streak">{display} gün</div>
                );
              })()}
              
              {isEditing && (
                <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); removeHabit(habit.id); }}>
                  <i className="fas fa-trash"></i>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {showEmojiPicker && createPortal(
        (
          <div key={pickerKey} className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(null)}>
            <div className="emoji-picker-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="emoji-picker-header">
                <span>Emoji seç</span>
                <button className="emoji-picker-close" onClick={() => setShowEmojiPicker(null)} aria-label="Kapat">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="emoji-grid">
                {emojiList.map((emoji) => (
                  <button
                    key={emoji}
                    className={`emoji-option ${tempEmoji === emoji ? 'selected' : ''}`}
                    onClick={() => onEmojiSelectTemp(emoji)}
                    aria-label={`Emoji ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowEmojiPicker(null)}>İptal</button>
                <button className="btn btn-primary" onClick={applyEmojiChange}>Kaydet</button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}
