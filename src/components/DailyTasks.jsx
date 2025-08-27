import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './DailyTasks.css';

const defaultTasks = [
  { time: '07:30', activity: 'Uyanış ve Sabah Rutini', id: 'wake-up' },
  { time: '08:00', activity: 'Sabah Hareketi (30dk Yürüyüş)', id: 'morning-exercise' },
  { time: '08:30', activity: 'Kahvaltı ve Güne Hazırlık', id: 'breakfast' },
  { time: '09:00', activity: 'ODAKLI YOUTUBE İŞLERİ', id: 'youtube-work' },
  { time: '13:15', activity: 'Öğle Yemeği ve Mola', id: 'lunch' },
  { time: '14:15', activity: 'ESNEK ZAMAN ( İşleri Hallet )', id: 'flexible-time' },
  { time: '17:15', activity: 'İngilizce Konuşma Pratiği', id: 'english-practice' },
  { time: '17:45', activity: 'Kişisel Zaman ve Akşam Yemeği Hazırlığı', id: 'personal-time' },
  { time: '19:00', activity: 'Akşam Yemeği', id: 'dinner' },
  { time: '20:00', activity: 'SOSYAL ZAMAN / HOBİLER', id: 'social-time' },
  { time: '23:30', activity: 'Akşam Rutini (Okuma, Şınav-Mekik)', id: 'evening-routine' },
  { time: '00:30', activity: 'Uyku', id: 'sleep' }
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
          setTasksByDay({ ...makeWeekFrom([]), ...data.tasksByDay });
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
      time: '09:00',
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
                  <input
                    type="time"
                    className="inline-edit time-input"
                    value={task.time}
                    onChange={(e) => handleTaskEdit(task.id, 'time', e.target.value)}
                    onBlur={handleTaskBlur}
                    onClick={(e) => e.stopPropagation()}
                  />
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
                  <div className="task-time">{task.time}</div>
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
