import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

  const getTodayKey = () => {
    return new Date().toISOString().split('T')[0];
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
    const dataToSave = {
      date: todayKey,
      completedTasks: Array.from(newData.completedTasks),
      completedHabits: Array.from(newData.completedHabits),
      notes: newData.notes,
      timestamp: serverTimestamp(),
      taskProgress: Math.round((newData.completedTasks.size / 13) * 100),
      habitProgress: Math.round((newData.completedHabits.size / 4) * 100)
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
