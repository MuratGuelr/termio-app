import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const GamificationContext = createContext();

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_TASK: { id: 'first_task', name: 'İlk Adım', description: 'İlk görevini tamamla', icon: '🎯', xp: 50 },
  TASK_STREAK_3: { id: 'task_streak_3', name: 'Tutarlılık', description: '3 gün üst üste görev tamamla', icon: '🔥', xp: 100 },
  TASK_STREAK_7: { id: 'task_streak_7', name: 'Haftalık Kahraman', description: '7 gün üst üste görev tamamla', icon: '⭐', xp: 250 },
  HABIT_MASTER: { id: 'habit_master', name: 'Alışkanlık Ustası', description: 'Tüm alışkanlıkları bir günde tamamla', icon: '👑', xp: 150 },
  EARLY_BIRD: { id: 'early_bird', name: 'Erken Kuş', description: 'Sabah 7\'den önce görev tamamla', icon: '🌅', xp: 75 },
  NIGHT_OWL: { id: 'night_owl', name: 'Gece Kuşu', description: 'Akşam 10\'dan sonra görev tamamla', icon: '🦉', xp: 75 },
  PERFECTIONIST: { id: 'perfectionist', name: 'Mükemmeliyetçi', description: 'Bir günde %100 görev tamamlama', icon: '💎', xp: 200 },
  HABIT_STREAK_7: { id: 'habit_streak_7', name: 'Alışkanlık Şampiyonu', description: 'Bir alışkanlığı 7 gün üst üste yap', icon: '🏆', xp: 300 },
  PRODUCTIVE_WEEK: { id: 'productive_week', name: 'Verimli Hafta', description: 'Haftalık ortalama %80 üzeri', icon: '📈', xp: 400 },
  LEVEL_5: { id: 'level_5', name: 'Deneyimli', description: '5. seviyeye ulaş', icon: '🌟', xp: 0 },
  LEVEL_10: { id: 'level_10', name: 'Uzman', description: '10. seviyeye ulaş', icon: '💫', xp: 0 },
  POMODORO_MASTER: { id: 'pomodoro_master', name: 'Pomodoro Ustası', description: '25 pomodoro tamamla', icon: '🍅', xp: 300 }
};

// Level calculation
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function xpForNextLevel(currentLevel) {
  return (currentLevel * currentLevel) * 100;
}

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState({
    xp: 0,
    level: 1,
    achievements: [],
    streaks: {
      currentTaskStreak: 0,
      longestTaskStreak: 0,
      habitStreaks: {}
    },
    totalTasksCompleted: 0,
    totalHabitsCompleted: 0,
    pomodoroSessions: 0
  });
  const [loading, setLoading] = useState(true);

  // Load user stats
  useEffect(() => {
    if (!user) return;
    
    const loadUserStats = async () => {
      setLoading(true);
      const ref = doc(db, 'users', user.uid, 'gamification', 'stats');
      const snap = await getDoc(ref);
      
      if (snap.exists()) {
        const data = snap.data();
        setUserStats(prev => ({
          ...prev,
          ...data,
          level: calculateLevel(data.xp || 0)
        }));
      }
      setLoading(false);
    };

    loadUserStats();
  }, [user]);

  // Save user stats
  const saveUserStats = async (newStats) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'gamification', 'stats');
    await setDoc(ref, newStats, { merge: true });
  };

  // Award XP and check for achievements
  const awardXP = async (amount, source = 'general') => {
    const newXP = userStats.xp + amount;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > userStats.level;
    
    const updatedStats = {
      ...userStats,
      xp: newXP,
      level: newLevel
    };

    // Check for level achievements
    if (leveledUp) {
      if (newLevel === 5 && !userStats.achievements.includes('level_5')) {
        updatedStats.achievements = [...userStats.achievements, 'level_5'];
      }
      if (newLevel === 10 && !userStats.achievements.includes('level_10')) {
        updatedStats.achievements = [...userStats.achievements, 'level_10'];
      }
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);

    return { leveledUp, newLevel, newXP };
  };

  // Check and award achievements
  const checkAchievements = async (context) => {
    const newAchievements = [];
    const { tasks, habits, completedTasks, completedHabits, timeOfDay } = context;

    // First task achievement
    if (!userStats.achievements.includes('first_task') && completedTasks > 0) {
      newAchievements.push('first_task');
    }

    // Perfect day achievement
    if (!userStats.achievements.includes('perfectionist') && tasks && tasks.length > 0) {
      const completionRate = (completedTasks / tasks.length) * 100;
      if (completionRate === 100) {
        newAchievements.push('perfectionist');
      }
    }

    // Habit master achievement
    if (!userStats.achievements.includes('habit_master') && habits && habits.length > 0) {
      const habitCompletionRate = (completedHabits / habits.length) * 100;
      if (habitCompletionRate === 100) {
        newAchievements.push('habit_master');
      }
    }

    // Time-based achievements
    if (timeOfDay && timeOfDay < 7 && !userStats.achievements.includes('early_bird')) {
      newAchievements.push('early_bird');
    }
    if (timeOfDay && timeOfDay >= 22 && !userStats.achievements.includes('night_owl')) {
      newAchievements.push('night_owl');
    }

    // Award XP for new achievements and update stats
    if (newAchievements.length > 0) {
      let totalXP = 0;
      newAchievements.forEach(achievementId => {
        totalXP += ACHIEVEMENTS[achievementId].xp;
      });

      const updatedStats = {
        ...userStats,
        achievements: [...userStats.achievements, ...newAchievements]
      };

      setUserStats(updatedStats);
      await saveUserStats(updatedStats);
      
      if (totalXP > 0) {
        await awardXP(totalXP, 'achievement');
      }

      return newAchievements.map(id => ACHIEVEMENTS[id]);
    }

    return [];
  };

  // Update streaks
  const updateStreaks = async (type, habitId = null) => {
    const today = dateKey();
    const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

    if (type === 'task') {
      // Check if user completed tasks yesterday to maintain streak
      const yesterdayRef = doc(db, 'users', user.uid, 'days', yesterday);
      const yesterdaySnap = await getDoc(yesterdayRef);
      
      let newStreak = 1;
      if (yesterdaySnap.exists()) {
        const yesterdayData = yesterdaySnap.data();
        const yesterdayTasks = yesterdayData.tasks || [];
        const yesterdayCompleted = yesterdayTasks.filter(t => t.done).length;
        
        if (yesterdayCompleted > 0) {
          newStreak = userStats.streaks.currentTaskStreak + 1;
        }
      }

      const updatedStats = {
        ...userStats,
        streaks: {
          ...userStats.streaks,
          currentTaskStreak: newStreak,
          longestTaskStreak: Math.max(userStats.streaks.longestTaskStreak, newStreak)
        }
      };

      // Check streak achievements
      if (newStreak >= 3 && !userStats.achievements.includes('task_streak_3')) {
        updatedStats.achievements = [...updatedStats.achievements, 'task_streak_3'];
        await awardXP(ACHIEVEMENTS.task_streak_3.xp, 'streak');
      }
      if (newStreak >= 7 && !userStats.achievements.includes('task_streak_7')) {
        updatedStats.achievements = [...updatedStats.achievements, 'task_streak_7'];
        await awardXP(ACHIEVEMENTS.task_streak_7.xp, 'streak');
      }

      setUserStats(updatedStats);
      await saveUserStats(updatedStats);
    }
  };

  // Track task completion
  const trackTaskCompletion = async (task, completed) => {
    if (completed) {
      const updatedStats = {
        ...userStats,
        totalTasksCompleted: userStats.totalTasksCompleted + 1
      };
      
      setUserStats(updatedStats);
      await saveUserStats(updatedStats);
      await awardXP(10, 'task_completion');
      
      // Check for time-based achievements
      const now = new Date();
      const timeOfDay = now.getHours();
      await checkAchievements({ 
        completedTasks: 1, 
        timeOfDay 
      });
      
      await updateStreaks('task');
    }
  };

  // Track habit completion
  const trackHabitCompletion = async (habit, completed) => {
    if (completed) {
      const updatedStats = {
        ...userStats,
        totalHabitsCompleted: userStats.totalHabitsCompleted + 1
      };
      
      setUserStats(updatedStats);
      await saveUserStats(updatedStats);
      await awardXP(15, 'habit_completion');
    }
  };

  // Track pomodoro session
  const trackPomodoroSession = async () => {
    const updatedStats = {
      ...userStats,
      pomodoroSessions: userStats.pomodoroSessions + 1
    };

    // Check for pomodoro achievement
    if (updatedStats.pomodoroSessions >= 25 && !userStats.achievements.includes('pomodoro_master')) {
      updatedStats.achievements = [...updatedStats.achievements, 'pomodoro_master'];
      await awardXP(ACHIEVEMENTS.pomodoro_master.xp, 'achievement');
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    await awardXP(25, 'pomodoro');
  };

  const value = {
    userStats,
    loading,
    awardXP,
    checkAchievements,
    trackTaskCompletion,
    trackHabitCompletion,
    trackPomodoroSession,
    updateStreaks,
    achievements: ACHIEVEMENTS,
    calculateLevel,
    xpForNextLevel
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}
