import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './DailyTasks.css';

const defaultTasks = [
  { startTime: '07:30', endTime: '08:00', activity: 'Uyanış ve Sabah Rutini', id: 'wake-up' },
  { startTime: '08:00', endTime: '08:30', activity: 'Sabah Hareketi (30dk Yürüyüş)', id: 'morning-exercise' },
  { startTime: '08:30', endTime: '09:00', activity: 'Kahvaltı ve Güne Hazırlık', id: 'breakfast' },
  { startTime: '09:00', endTime: '13:15', activity: 'ODAKLI YOUTUBE İŞLERİ', id: 'youtube-work' },
  { startTime: '13:15', endTime: '14:15', activity: 'Öğle Yemeği ve Mola', id: 'lunch' },
  { startTime: '14:15', endTime: '17:15', activity: 'ESNEK ZAMAN ( İşleri Hallet )', id: 'flexible-time' },
  { startTime: '17:15', endTime: '17:45', activity: 'İngilizce Konuşma Pratiği', id: 'english-practice' },
  { startTime: '17:45', endTime: '19:00', activity: 'Kişisel Zaman ve Akşam Yemeği Hazırlığı', id: 'personal-time' },
  { startTime: '19:00', endTime: '20:00', activity: 'Akşam Yemeği', id: 'dinner' },
  { startTime: '20:00', endTime: '23:30', activity: 'SOSYAL ZAMAN / HOBİLER', id: 'social-time' },
  { startTime: '23:30', endTime: '00:30', activity: 'Akşam Rutini (Okuma, Şınav-Mekik)', id: 'evening-routine' },
  { startTime: '00:30', endTime: '07:30', activity: 'Uyku', id: 'sleep' }
];

// Helpers - Turkish week starts from Monday
const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const trDayShort = {
  monday: 'Pzt',
  tuesday: 'Sal',
  wednesday: 'Çar',
  thursday: 'Per',
  friday: 'Cum',
  saturday: 'Cmt',
  sunday: 'Pzr',
};
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
  const clone = (a) => (Array.isArray(a) ? a.map(t => ({ ...t })) : []);
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

export default function DailyTasks({ completedTasks, onToggleTask, onStartFocusMode, isEditing, selectedDay }) {
  const { user } = useAuth();
  const [tasksByDay, setTasksByDay] = useState(makeWeekFrom(defaultTasks));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserTasks();
    }
  }, [user]);

  const loadUserTasks = async () => {
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'tasks');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tasksByDay && typeof data.tasksByDay === 'object') {
          // Migrate old time format to new startTime/endTime format
          const migratedTasks = {};
          Object.keys(data.tasksByDay).forEach(day => {
            migratedTasks[day] = data.tasksByDay[day].map(task => {
              if (task.time && !task.startTime) {
                // Migrate old format: assume 1 hour duration
                const startTime = task.time;
                const [hours, minutes] = startTime.split(':').map(Number);
                const endHours = (hours + 1) % 24;
                const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                return { ...task, startTime, endTime, time: undefined };
              }
              return task;
            });
          });
          setTasksByDay({ ...makeWeekFrom([]), ...migratedTasks });
          await saveUserTasks(migratedTasks); // Save migrated data
        } else {
          const base = Array.isArray(data.tasks) && data.tasks.length > 0 ? data.tasks : defaultTasks;
          const week = makeWeekFrom(base);
          setTasksByDay(week);
          await saveUserTasks(week); // migrate
        }
      } else {
        const week = makeWeekFrom(defaultTasks);
        setTasksByDay(week);
        await saveUserTasks(week);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      const week = makeWeekFrom(defaultTasks);
      setTasksByDay(week);
    }
    setLoading(false);
  };

  const saveUserTasks = async (weekToSave) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'tasks');
      await setDoc(docRef, { tasksByDay: weekToSave }, { merge: true });
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  const handleTaskEdit = (taskId, field, value) => {
    const dayTasks = tasksByDay[selectedDay] || [];
    const updatedTasks = dayTasks.map(task => 
      task.id === taskId ? { ...task, [field]: value } : task
    );
    const updatedWeek = { ...tasksByDay, [selectedDay]: updatedTasks };
    setTasksByDay(updatedWeek);
  };

  const handleTaskBlur = () => {
    saveUserTasks(tasksByDay);
  };

  const addTask = () => {
    const newTask = {
      id: `task-${Date.now()}`,
      startTime: '09:00',
      endTime: '10:00',
      activity: 'Yeni Görev'
    };
    const dayTasks = tasksByDay[selectedDay] || [];
    const updatedTasks = [...dayTasks, newTask];
    const updatedWeek = { ...tasksByDay, [selectedDay]: updatedTasks };
    setTasksByDay(updatedWeek);
    saveUserTasks(updatedWeek);
  };

  const removeTask = (taskId) => {
    const dayTasks = tasksByDay[selectedDay] || [];
    const updatedTasks = dayTasks.filter(task => task.id !== taskId);
    const updatedWeek = { ...tasksByDay, [selectedDay]: updatedTasks };
    setTasksByDay(updatedWeek);
    saveUserTasks(updatedWeek);
  };

  const moveTask = (taskId, direction) => {
    const dayTasks = tasksByDay[selectedDay] || [];
    const currentIndex = dayTasks.findIndex(task => task.id === taskId);
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= dayTasks.length) return;
    const updatedTasks = [...dayTasks];
    const [movedTask] = updatedTasks.splice(currentIndex, 1);
    updatedTasks.splice(newIndex, 0, movedTask);
    const updatedWeek = { ...tasksByDay, [selectedDay]: updatedTasks };
    setTasksByDay(updatedWeek);
    saveUserTasks(updatedWeek);
  };
  const tasks = useMemo(() => tasksByDay[selectedDay] || [], [tasksByDay, selectedDay]);
  const isTodaySelected = useMemo(() => selectedDay === getTodayDayKey(), [selectedDay]);
  const progress = useMemo(() => {
    const total = tasks.length || 1;
    const completed = isTodaySelected ? completedTasks.size : 0;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [completedTasks, tasks.length, isTodaySelected]);

  const handleTaskClick = (taskId) => {
    if (isEditing) return;
    if (!isTodaySelected) return; // sadece bugünün listesinde tamamlanma işaretlenebilir
    const isCompleted = completedTasks.has(taskId);
    onToggleTask(taskId, !isCompleted);
  };

  const handleFocusClick = (e, task) => {
    e.stopPropagation();
    onStartFocusMode(task);
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="card" id="tasksSection">
      <div className="card-header">
        <h3>
          <i className="fas fa-tasks"></i>
          Günlük Görevler
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="selected-day-label" style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>{trDayFull[selectedDay]}</span>
          {isEditing && (
            <button className="add-btn" onClick={addTask}>
              <i className="fas fa-plus"></i>
            </button>
          )}
        </div>
      </div>
      
      <div className="progress-container">
        <div className="progress-label">
          <span>İlerleme</span>
          <span id="taskProgress">{progress.completed}/{progress.total}</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            id="taskProgressBar" 
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>

      <ul className="task-list" id="taskList">
        {tasks.map((task, index) => {
          const isCompleted = completedTasks.has(task.id);
          return (
            <li 
              key={task.id}
              className={`task-item ${isCompleted ? 'completed' : ''} ${isEditing ? 'editing' : ''}`}
              onClick={() => handleTaskClick(task.id)}
            >
              {isEditing && (
                <div className="task-controls">
                  <button 
                    className="move-btn" 
                    onClick={(e) => { e.stopPropagation(); moveTask(task.id, -1); }}
                    disabled={index === 0}
                  >
                    <i className="fas fa-chevron-up"></i>
                  </button>
                  <button 
                    className="move-btn" 
                    onClick={(e) => { e.stopPropagation(); moveTask(task.id, 1); }}
                    disabled={index === tasks.length - 1}
                  >
                    <i className="fas fa-chevron-down"></i>
                  </button>
                </div>
              )}
              
              <div className="task-checkbox">
                {isCompleted && <i className="fas fa-check"></i>}
              </div>
              
              {isEditing ? (
                <>
                  <div className="time-range-inputs">
                    <input
                      type="time"
                      className="inline-edit time-input"
                      value={task.startTime || task.time || '09:00'}
                      onChange={(e) => handleTaskEdit(task.id, 'startTime', e.target.value)}
                      onBlur={handleTaskBlur}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="time-separator">-</span>
                    <input
                      type="time"
                      className="inline-edit time-input"
                      value={task.endTime || '10:00'}
                      onChange={(e) => handleTaskEdit(task.id, 'endTime', e.target.value)}
                      onBlur={handleTaskBlur}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <input
                    type="text"
                    className="inline-edit task-input"
                    value={task.activity}
                    onChange={(e) => handleTaskEdit(task.id, 'activity', e.target.value)}
                    onBlur={handleTaskBlur}
                    onClick={(e) => e.stopPropagation()}
                  />
                </>
              ) : (
                <>
                  <div className="task-time">
                    {task.startTime || task.time || '09:00'} - {task.endTime || '10:00'}
                  </div>
                  <div className="task-text">{task.activity}</div>
                </>
              )}
              
              {isEditing ? (
                <button 
                  className="delete-btn" 
                  onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              ) : (
                <button 
                  className="focus-btn" 
                  onClick={(e) => handleFocusClick(e, task)}
                  title="Bu Görevi Odaklanma Modunda Yap"
                >
                  <i className="fas fa-hourglass-start"></i>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
