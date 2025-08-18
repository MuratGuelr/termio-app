import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './DailyTasks.css';

const defaultTasks = [
  { time: '07:30', activity: 'Uyanış ve Sabah Rutini', id: 'wake-up' },
  { time: '08:00', activity: 'Sabah Hareketi (30dk Yürüyüş)', id: 'morning-exercise' },
  { time: '08:30', activity: 'Kahvaltı ve Güne Hazırlık', id: 'breakfast' },
  { time: '09:00', activity: 'Günlük Plan ve YouTube Fikirleri', id: 'daily-plan' },
  { time: '09:15', activity: 'ODAKLI YOUTUBE İŞLERİ', id: 'youtube-work' },
  { time: '13:15', activity: 'Öğle Yemeği ve Mola', id: 'lunch' },
  { time: '14:15', activity: 'ESNEK ZAMAN', id: 'flexible-time' },
  { time: '17:15', activity: 'İngilizce Konuşma Pratiği', id: 'english-practice' },
  { time: '17:45', activity: 'Kişisel Zaman ve Akşam Yemeği Hazırlığı', id: 'personal-time' },
  { time: '19:00', activity: 'Akşam Yemeği', id: 'dinner' },
  { time: '20:00', activity: 'SOSYAL ZAMAN / HOBİLER', id: 'social-time' },
  { time: '23:30', activity: 'Akşam Rutini (Okuma, Şınav-Mekik)', id: 'evening-routine' },
  { time: '00:30', activity: 'Uyku', id: 'sleep' }
];

export default function DailyTasks({ completedTasks, onToggleTask, onStartFocusMode, isEditing }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(defaultTasks);
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
        setTasks(docSnap.data().tasks || defaultTasks);
      } else {
        setTasks(defaultTasks);
        await saveUserTasks(defaultTasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks(defaultTasks);
    }
    setLoading(false);
  };

  const saveUserTasks = async (tasksToSave) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'tasks');
      await setDoc(docRef, { tasks: tasksToSave });
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  const handleTaskEdit = (taskId, field, value) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, [field]: value } : task
    );
    setTasks(updatedTasks);
  };

  const handleTaskBlur = () => {
    saveUserTasks(tasks);
  };

  const addTask = () => {
    const newTask = {
      id: `task-${Date.now()}`,
      time: '09:00',
      activity: 'Yeni Görev'
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    saveUserTasks(updatedTasks);
  };

  const removeTask = (taskId) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    saveUserTasks(updatedTasks);
  };

  const moveTask = (taskId, direction) => {
    const currentIndex = tasks.findIndex(task => task.id === taskId);
    const newIndex = currentIndex + direction;
    
    if (newIndex < 0 || newIndex >= tasks.length) return;
    
    const updatedTasks = [...tasks];
    const [movedTask] = updatedTasks.splice(currentIndex, 1);
    updatedTasks.splice(newIndex, 0, movedTask);
    
    setTasks(updatedTasks);
    saveUserTasks(updatedTasks);
  };
  const progress = useMemo(() => {
    const completed = completedTasks.size;
    const total = tasks.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [completedTasks, tasks.length]);

  const handleTaskClick = (taskId) => {
    if (isEditing) return;
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
        {isEditing && (
          <button className="add-btn" onClick={addTask}>
            <i className="fas fa-plus"></i>
          </button>
        )}
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
