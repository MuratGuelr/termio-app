import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';
import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import DailyTasks from './DailyTasks';
import DailyHabits from './DailyHabits';
import DailyNotes from './DailyNotes';
import Goals from './Goals';
import Statistics from './Statistics';
import './MainContent.css';

const quotes = [
  "Her küçük adım, büyük bir değişimin başlangıcıdır.",
  "Başarı, günlük tekrarların toplamıdır.",
  "Bugün kendine yatırım yap, yarın hasat et.",
  "Hedefleriniz hayallerinizden büyük olsun.",
  "Değişim zor görünebilir, ancak pişmanlık daha zordur.",
  "İlerlemek için mükemmel olmak zorunda değilsiniz.",
  "Her gün biraz daha iyiye doğru."
];

export default function MainContent({ onStartFocusMode, onOpenGoalModal, onTriggerCelebration, isEditing }) {
  const { user } = useAuth();
  const { trackHabitCompletion } = useGamification();
  const [dailyQuote, setDailyQuote] = useState(quotes[0]);
  const [currentData, setCurrentData] = useState({
    completedTasks: new Set(),
    completedHabits: new Set(),
    notes: ''
  });

  const today = useMemo(() => new Date().toLocaleDateString('tr-TR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), []);

  useEffect(() => {
    // Set random daily quote
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setDailyQuote(randomQuote);
    
    // Load user data
    if (user) {
      loadUserData();
    }
  }, [user]);

  // Weekly pass controls moved to SettingsModal

  // Detect local-day rollover and refresh data
  useEffect(() => {
    if (!user) return;
    let prevKey = getTodayKey();
    const timer = setInterval(() => {
      const k = getTodayKey();
      if (k !== prevKey) {
        prevKey = k;
        loadUserData();
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(timer);
  }, [user]);

  const getTodayKey = () => {
    // Istanbul day cutoff at 02:00 local time: subtract 2h before formatting
    const t = new Date();
    t.setHours(t.getHours() - 2);
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const loadUserData = async () => {
    if (!user) return;

    const todayKey = getTodayKey();
    
    try {
      const docRef = doc(db, 'users', user.uid, 'days', todayKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentData({
          completedTasks: new Set(data.completedTasks || []),
          completedHabits: new Set(data.completedHabits || []),
          notes: data.notes || ''
        });
      } else {
        setCurrentData({
          completedTasks: new Set(),
          completedHabits: new Set(),
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const saveDailyData = async (newData) => {
    if (!user) return;

    const todayKey = getTodayKey();
    // Fetch current totals from settings to avoid hardcoded denominators
    let totalTasks = 13;
    let totalHabits = 4;
    try {
      const [tSnap, hSnap] = await Promise.all([
        getDoc(doc(db, 'users', user.uid, 'settings', 'tasks')),
        getDoc(doc(db, 'users', user.uid, 'settings', 'habits')),
      ]);
      if (tSnap.exists()) {
        const arr = Array.isArray(tSnap.data()?.tasks) ? tSnap.data().tasks : [];
        totalTasks = arr.length || totalTasks;
      }
      if (hSnap.exists()) {
        const arr = Array.isArray(hSnap.data()?.habits) ? hSnap.data().habits : [];
        totalHabits = arr.length || totalHabits;
      }
    } catch (e) {
      // keep defaults on error
      console.warn('Could not load settings totals, using defaults', e);
    }

    const taskDenom = totalTasks || 1;
    const habitDenom = totalHabits || 1;
    const dataToSave = {
      date: todayKey,
      completedTasks: Array.from(newData.completedTasks),
      completedHabits: Array.from(newData.completedHabits),
      notes: newData.notes,
      timestamp: serverTimestamp(),
      totalTasks,
      totalHabits,
      taskProgress: Math.round((newData.completedTasks.size / taskDenom) * 100),
      habitProgress: Math.round((newData.completedHabits.size / habitDenom) * 100)
    };

    try {
      const docRef = doc(db, 'users', user.uid, 'days', todayKey);
      await setDoc(docRef, dataToSave, { merge: true });
      setCurrentData(newData);
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  };

  const updateTaskCompletion = async (taskId, completed) => {
    const newCompletedTasks = new Set(currentData.completedTasks);
    if (completed) {
      newCompletedTasks.add(taskId);
    } else {
      newCompletedTasks.delete(taskId);
    }

    const newData = {
      ...currentData,
      completedTasks: newCompletedTasks
    };

    await saveDailyData(newData);

    // Check if all tasks completed for celebration
    if (newCompletedTasks.size === 13) {
      onTriggerCelebration();
    }
  };

  const updateHabitCompletion = async (habitId, completed) => {
    const newCompletedHabits = new Set(currentData.completedHabits);
    if (completed) {
      newCompletedHabits.add(habitId);
    } else {
      newCompletedHabits.delete(habitId);
    }

    const newData = {
      ...currentData,
      completedHabits: newCompletedHabits
    };

    await saveDailyData(newData);
    // Update gamification streaks when marking as completed
    if (completed) {
      try { await trackHabitCompletion({ id: habitId }, true); } catch (e) { /* no-op */ }
    }
  };

  const updateNotes = async (notes) => {
    const newData = {
      ...currentData,
      notes
    };

    await saveDailyData(newData);
  };

  return (
    <main className="main-content">
      {/* Date Header */}
      <div className="date-header" id="homeSection">
        <h2 id="currentDate">{today}</h2>
        <p>Bugün de harika bir gün olacak! 🌟</p>
        {/* Günlük geçiş (streak hakkı) kontrolleri Ayarlar'a taşındı */}
      </div>

      {/* Motivational Quote */}
      <div className="quote-card">
        <div className="quote-text" id="dailyQuote">
          {dailyQuote}
        </div>
      </div>

      {/* Dashboard */}
      <div className="dashboard-grid">
        {/* Daily Tasks */}
        <DailyTasks 
          completedTasks={currentData.completedTasks}
          onToggleTask={updateTaskCompletion}
          onStartFocusMode={onStartFocusMode}
          isEditing={isEditing}
        />

        {/* Habits */}
        <DailyHabits 
          completedHabits={currentData.completedHabits}
          onToggleHabit={updateHabitCompletion}
          isEditing={isEditing}
        />

        {/* Notes */}
        <DailyNotes 
          notes={currentData.notes}
          onUpdateNotes={updateNotes}
        />

        {/* Goals */}
        <Goals onOpenGoalModal={onOpenGoalModal} />

        {/* Statistics */}
        <Statistics />
      </div>
    </main>
  );
}
