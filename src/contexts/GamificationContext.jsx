import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const GamificationContext = createContext();

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context) return context;
  // Safe fallback to avoid runtime errors when provider is missing.
  // Provides minimal no-op implementations used by dependent components.
  const fallback = {
    userStats: {
      xp: 0,
      level: 1,
      achievements: [],
      pomodoroSessions: 0,
      decor: { inventory: [], placed: [] },
      streaks: {
        daily: { current: 0, longest: 0, lastActivityDate: null },
        tasks: { current: 0, longest: 0, lastCompletionDate: null },
        habits: {}
      },
      totalTasksCompleted: 0,
      totalHabitsCompleted: 0
    },
    loading: false,
    awardXP: async () => ({ leveledUp: false, newLevel: 1, newXP: 0 }),
    spendXP: async () => ({ ok: false, reason: 'provider_missing', xp: 0 }),
    addDecorToInventory: async () => ({ ok: false, reason: 'provider_missing' }),
    placeDecor: async () => ({ ok: false, reason: 'provider_missing' }),
    updateDecorPosition: async () => ({ ok: false, reason: 'provider_missing' }),
    removeDecor: async () => ({ ok: false, reason: 'provider_missing' }),
    updateDecorScale: async () => ({ ok: false, reason: 'provider_missing' }),
    purchaseLand: async () => ({ ok: false, reason: 'provider_missing' }),
    buildHouseStage: async () => ({ ok: false, reason: 'provider_missing' }),
    checkAchievements: async () => [],
    trackTaskCompletion: async () => {},
    trackHabitCompletion: async () => {},
    trackPomodoroSession: async () => {},
    updateStreaks: async () => {},
    updateDailyStreak: async () => {},
    updateTaskStreak: async () => {},
    updateHabitStreak: async () => {},
    achievements: {},
    calculateLevel: (xp) => Math.floor(Math.sqrt((xp || 0) / 100)) + 1,
    xpForNextLevel: (lvl) => (lvl * lvl) * 100,
    canUseWeeklyPass: () => ({ ok: false, reason: 'provider_missing' }),
    useWeeklyPass: async () => ({ ok: false, reason: 'provider_missing' }),
    canUndoWeeklyPass: () => ({ ok: false, reason: 'provider_missing' }),
    undoWeeklyPass: async () => ({ ok: false, reason: 'provider_missing' })
  };
  return fallback;
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
  POMODORO_MASTER: { id: 'pomodoro_master', name: 'Pomodoro Ustası', description: '25 pomodoro tamamla', icon: '🍅', xp: 300 },
  DAILY_STREAK_3: { id: 'daily_streak_3', name: 'Isınıyorum', description: '3 gün üst üste aktif ol', icon: '🔥', xp: 100 },
  DAILY_STREAK_7: { id: 'daily_streak_7', name: 'Ritmi Yakaladım', description: '7 gün üst üste aktif ol', icon: '⚡', xp: 250 },
  DAILY_STREAK_30: { id: 'daily_streak_30', name: 'Demir İrade', description: '30 gün üst üste aktif ol', icon: '🏅', xp: 800 }
};

// Level calculation
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function xpForNextLevel(currentLevel) {
  return (currentLevel * currentLevel) * 100;
}

// Rank thresholds
const RANKS = [
  { minLevel: 1, name: 'Novice', icon: '🐣' },
  { minLevel: 5, name: 'Bronz', icon: '🥉' },
  { minLevel: 10, name: 'Gümüş', icon: '🥈' },
  { minLevel: 15, name: 'Altın', icon: '🥇' },
  { minLevel: 20, name: 'Elmas', icon: '💎' },
  { minLevel: 30, name: 'Usta', icon: '🏆' }
];

function getRankForLevel(level) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r; else break;
  }
  return current;
}

function dateKey(d = new Date()) {
  // Istanbul day cutoff at 02:00 local time: subtract 2h before formatting
  const t = new Date(d);
  t.setHours(t.getHours() - 2);
  const year = t.getFullYear();
  const month = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDateKey(d = new Date()) {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return dateKey(y);
}

// Helpers for weekly pass (ISO week, Monday start), with 02:00 TRT cutoff
function getTRTDate(base = new Date()) {
  const t = new Date(base);
  t.setHours(t.getHours() - 2);
  return t;
}

function isWeekdayTRT(d = new Date()) {
  const t = getTRTDate(d);
  const dow = t.getDay(); // 0 Sun ... 6 Sat
  return dow >= 1 && dow <= 5; // Mon-Fri only
}

function isoWeekKeyTRT(d = new Date()) {
  const t = getTRTDate(d);
  // Copy date and set to Thursday of this week for ISO week-year
  const dt = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // Thu
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNo = 1 + Math.round((dt - firstThursday) / (7 * 24 * 3600 * 1000));
  const weekYear = dt.getUTCFullYear();
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`;
}

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState({
    xp: 0,
    level: 1,
    rank: getRankForLevel(1),
    achievements: [],
    streaks: {
      daily: { current: 0, longest: 0, lastActivityDate: null },
      tasks: { current: 0, longest: 0, lastCompletionDate: null },
      habits: {}
    },
    house: {
      landPurchased: false,
      buildingStage: 'none', // 'none', 'foundation', 'walls', 'roof', 'completed'
      exteriorDecor: {
        inventory: [],
        placed: []
      },
      interiorDecor: {
        inventory: [],
        placed: []
      }
    },
    pomodoroSessions: 0,
    totalTasksCompleted: 0,
    totalHabitsCompleted: 0,
    weeklyPass: { weekKey: null, used: false, snapshot: null }
  });
  const [loading, setLoading] = useState(true);

  // Emit helper for UI events (toasts/modals)
  const emit = (name, detail) => {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) {
      // no-op
    }
  };

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
          level: calculateLevel(data.xp || 0),
          rank: data.rank || getRankForLevel(calculateLevel(data.xp || 0))
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

  // Weekly pass API
  const canUseWeeklyPass = (base = new Date()) => {
    const wk = isoWeekKeyTRT(base);
    // Only Mon-Fri allowed
    if (!isWeekdayTRT(base)) return { ok: false, reason: 'weekend_not_allowed' };
    if (userStats.weeklyPass?.weekKey === wk && userStats.weeklyPass?.used) {
      return { ok: false, reason: 'already_used_this_week' };
    }
    return { ok: true };
  };

  const undoWeeklyPass = async () => {
    const now = new Date();
    const today = dateKey(now);
    const wk = isoWeekKeyTRT(now);
    const wp = userStats.weeklyPass || {};
    if (!wp.used) return { ok: false, reason: 'not_used' };
    if (wp.weekKey !== wk) return { ok: false, reason: 'different_week' };
    let snap = wp.snapshot || null;
    let allowSameDay = (snap && snap.day === today) || wp.lastUsedDay === today;
    // If still not allowed, check today's day doc for passUsed flag
    if (!allowSameDay && user) {
      try {
        const dayRef = doc(db, 'users', user.uid, 'days', today);
        const daySnap = await getDoc(dayRef);
        if (daySnap.exists() && daySnap.data()?.passUsed) {
          allowSameDay = true;
        }
      } catch (_) {}
    }
    if (!allowSameDay) return { ok: false, reason: 'not_today' };

    // 1) Unset pass on day doc
    if (user) {
      const dayRef = doc(db, 'users', user.uid, 'days', today);
      await setDoc(dayRef, { passUsed: false, passTimestamp: null }, { merge: true });
    }

    // 2) Restore streaks from snapshot if available and same day; otherwise keep current streaks
    let newStats;
    if (snap && snap.day === today) {
      const currentHabits = { ...(userStats.streaks?.habits || {}) };
      const restoredHabits = { ...currentHabits };
      if (snap.prevHabits) {
        for (const hid of Object.keys(snap.prevHabits)) {
          restoredHabits[hid] = { ...snap.prevHabits[hid] };
        }
      }
      newStats = {
        ...userStats,
        weeklyPass: { weekKey: wp.weekKey, used: false, lastUsedDay: null, snapshot: null },
        streaks: {
          ...userStats.streaks,
          daily: { ...snap.prevDaily },
          tasks: { ...snap.prevTasks },
          habits: restoredHabits
        }
      };
      setUserStats(newStats);
      await saveUserStats(newStats);
      emit('streak_updated', { type: 'daily', current: newStats.streaks.daily.current, longest: newStats.streaks.daily.longest });
      emit('streak_updated', { type: 'task', current: newStats.streaks.tasks.current, longest: newStats.streaks.tasks.longest });
    } else {
      // Fallback: just mark weekly pass as unused, do not mutate streaks
      newStats = {
        ...userStats,
        weeklyPass: { weekKey: wp.weekKey, used: false, lastUsedDay: null, snapshot: null }
      };
      setUserStats(newStats);
      await saveUserStats(newStats);
    }
    emit('pass_undone', { day: today, weekKey: wp.weekKey });
    return { ok: true };
  };

  const canUndoWeeklyPass = (base = new Date()) => {
    const wk = isoWeekKeyTRT(base);
    const today = dateKey(base);
    const wp = userStats.weeklyPass || {};
    if (!wp.used) return { ok: false, reason: 'not_used' };
    if (wp.weekKey !== wk) return { ok: false, reason: 'different_week' };
    // Allow based on snapshot day OR recorded lastUsedDay
    if ((wp.snapshot && wp.snapshot.day === today) || wp.lastUsedDay === today) return { ok: true };
    return { ok: false, reason: 'not_today' };
  };

  const useWeeklyPass = async () => {
    const now = new Date();
    const eligible = canUseWeeklyPass(now);
    if (!eligible.ok) return eligible;

    const today = dateKey(now);
    const weekKey = isoWeekKeyTRT(now);

    // 1) Mark day document with passUsed
    if (user) {
      const dayRef = doc(db, 'users', user.uid, 'days', today);
      await setDoc(dayRef, { passUsed: true, passTimestamp: new Date().toISOString() }, { merge: true });
    }

    // 2) Load habits from settings to update per-habit streaks
    let habitIds = [];
    try {
      if (user) {
        const habitsSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'habits'));
        if (habitsSnap.exists()) {
          const arr = Array.isArray(habitsSnap.data()?.habits) ? habitsSnap.data().habits : [];
          habitIds = arr.map(h => h.id).filter(Boolean);
        }
      }
    } catch (_) {}

    // 3) Update streaks (treat today as completed for all streak types)
    const prevDaily = userStats.streaks?.daily || { current: 0, longest: 0, lastActivityDate: null };
    const prevTasks = userStats.streaks?.tasks || { current: 0, longest: 0, lastCompletionDate: null };
    const yesterday = previousDateKey(now);

    const nextDailyCurrent = prevDaily.lastActivityDate === today ? prevDaily.current : (prevDaily.lastActivityDate === yesterday ? prevDaily.current + 1 : 1);
    const nextTasksCurrent = prevTasks.lastCompletionDate === today ? prevTasks.current : (prevTasks.lastCompletionDate === yesterday ? prevTasks.current + 1 : 1);

    const nextHabits = { ...(userStats.streaks?.habits || {}) };
    const snapshotHabits = {};
    for (const hid of habitIds) {
      const prev = nextHabits[hid] || { current: 0, longest: 0, lastCompletionDate: null };
      snapshotHabits[hid] = { ...prev };
      const nextCurrent = prev.lastCompletionDate === today ? prev.current : (prev.lastCompletionDate === yesterday ? prev.current + 1 : 1);
      nextHabits[hid] = {
        current: nextCurrent,
        longest: Math.max(prev.longest || 0, nextCurrent),
        lastCompletionDate: today
      };
    }

    const updatedStats = {
      ...userStats,
      weeklyPass: {
        weekKey,
        used: true,
        lastUsedDay: today,
        snapshot: {
          day: today,
          prevDaily,
          prevTasks,
          prevHabits: snapshotHabits
        }
      },
      streaks: {
        ...userStats.streaks,
        daily: { current: nextDailyCurrent, longest: Math.max(prevDaily.longest || 0, nextDailyCurrent), lastActivityDate: today },
        tasks: { current: nextTasksCurrent, longest: Math.max(prevTasks.longest || 0, nextTasksCurrent), lastCompletionDate: today },
        habits: nextHabits
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);

    emit('pass_used', { day: today, weekKey });
    emit('streak_updated', { type: 'daily', current: updatedStats.streaks.daily.current, longest: updatedStats.streaks.daily.longest });
    emit('streak_updated', { type: 'task', current: updatedStats.streaks.tasks.current, longest: updatedStats.streaks.tasks.longest });
    return { ok: true };
  };

  // Spend XP safely for purchases
  const spendXP = async (amount) => {
    if (amount <= 0) return { ok: true, xp: userStats.xp };
    if (userStats.xp < amount) {
      return { ok: false, reason: 'not_enough_xp', xp: userStats.xp };
    }
    const newXP = userStats.xp - amount;
    const newLevel = calculateLevel(newXP);
    const updatedStats = { ...userStats, xp: newXP, level: newLevel };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true, xp: newXP };
  };

  // Decor inventory helpers
  const addDecorToInventory = async (item, area = 'exterior') => {
    const targetArea = area === 'interior' ? 'interiorDecor' : 'exteriorDecor';
    const updatedStats = {
      ...userStats,
      house: {
        ...userStats.house,
        [targetArea]: {
          ...userStats.house?.[targetArea],
          inventory: [...(userStats.house?.[targetArea]?.inventory || []), item]
        }
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const placeDecor = async (id, x, y, area = 'exterior') => {
    const targetArea = area === 'interior' ? 'interiorDecor' : 'exteriorDecor';
    const inv = userStats.house?.[targetArea]?.inventory || [];
    const item = inv.find(i => i.id === id);
    if (!item) return { ok: false, reason: 'not_owned' };
    
    const updatedStats = {
      ...userStats,
      house: {
        ...userStats.house,
        [targetArea]: {
          ...userStats.house?.[targetArea],
          placed: [...(userStats.house?.[targetArea]?.placed || []), { id, x, y, scale: 1 }]
        }
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const updateDecorPosition = async (id, x, y, area = 'exterior') => {
    const targetArea = area === 'interior' ? 'interiorDecor' : 'exteriorDecor';
    const placed = userStats.house?.[targetArea]?.placed || [];
    const exists = placed.some(p => p.id === id);
    if (!exists) return { ok: false, reason: 'not_placed' };
    
    const newPlaced = placed.map(p => (p.id === id ? { ...p, x, y } : p));
    const updatedStats = {
      ...userStats,
      house: {
        ...userStats.house,
        [targetArea]: {
          ...userStats.house?.[targetArea],
          placed: newPlaced
        }
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const removeDecor = async (id, area = 'exterior') => {
    const targetArea = area === 'interior' ? 'interiorDecor' : 'exteriorDecor';
    const placed = userStats.house?.[targetArea]?.placed || [];
    const newPlaced = placed.filter(p => p.id !== id);
    
    const updatedStats = {
      ...userStats,
      house: {
        ...userStats.house,
        [targetArea]: {
          ...userStats.house?.[targetArea],
          placed: newPlaced
        }
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const updateDecorScale = async (id, scale, area = 'exterior') => {
    const targetArea = area === 'interior' ? 'interiorDecor' : 'exteriorDecor';
    const placed = userStats.house?.[targetArea]?.placed || [];
    const exists = placed.some(p => p.id === id);
    if (!exists) return { ok: false, reason: 'not_placed' };
    
    const clamped = Math.max(0.5, Math.min(2, scale));
    const newPlaced = placed.map(p => (p.id === id ? { ...p, scale: clamped } : p));
    const updatedStats = {
      ...userStats,
      house: {
        ...userStats.house,
        [targetArea]: {
          ...userStats.house?.[targetArea],
          placed: newPlaced
        }
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const purchaseLand = async () => {
    const landCost = 500; // XP cost for land
    if (userStats.xp < landCost) return { ok: false, reason: 'insufficient_xp' };
    if (userStats.house?.landPurchased) return { ok: false, reason: 'already_purchased' };
    
    const updatedStats = {
      ...userStats,
      xp: userStats.xp - landCost,
      house: {
        ...userStats.house,
        landPurchased: true
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  const buildHouseStage = async (stage) => {
    const stageCosts = {
      foundation: 300,
      walls: 400,
      roof: 350
    };
    const stageOrder = ['foundation', 'walls', 'roof'];
    const currentStage = userStats.house?.buildingStage || 'land';
    const currentStageIndex = stageOrder.indexOf(currentStage);
    const nextStageIndex = stageOrder.indexOf(stage);
    
    // Allow progression from 'land' to 'foundation' (index -1 to 0)
    const expectedIndex = currentStage === 'land' ? -1 : currentStageIndex;
    if (nextStageIndex !== expectedIndex + 1) return { ok: false, reason: 'wrong_order' };
    if (userStats.xp < stageCosts[stage]) return { ok: false, reason: 'insufficient_xp' };
    if (!userStats.house?.landPurchased) return { ok: false, reason: 'no_land' };
    
    const newStage = stage === 'roof' ? 'completed' : stage;
    const updatedStats = {
      ...userStats,
      xp: userStats.xp - stageCosts[stage],
      house: {
        ...userStats.house,
        buildingStage: newStage
      }
    };
    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    return { ok: true };
  };

  // Award XP and check for achievements
  const awardXP = async (amount, source = 'general') => {
    const newXP = userStats.xp + amount;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > userStats.level;
    const prevRank = userStats.rank || getRankForLevel(userStats.level);
    const nextRank = getRankForLevel(newLevel);
    
    const updatedStats = {
      ...userStats,
      xp: newXP,
      level: newLevel,
      rank: nextRank
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

    // Emit rank up when threshold crossed
    if (nextRank?.name !== prevRank?.name) {
      emit('rank_up', { from: prevRank, to: nextRank, level: newLevel });
    }

    // Emit level up event
    if (leveledUp) {
      emit('level_up', { from: userStats.level, to: newLevel, xp: newXP });
    }

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

      // emit achievements unlocked
      emit('achievements_unlocked', { ids: newAchievements.map(id => ACHIEVEMENTS[id]) });

      return newAchievements.map(id => ACHIEVEMENTS[id]);
    }

    return [];
  };

  // Update streaks
  const updateDailyStreak = async () => {
    const today = dateKey();
    const yesterday = previousDateKey();
    const prev = userStats.streaks?.daily || { current: 0, longest: 0, lastActivityDate: null };

    let current = prev.current;
    const broken = prev.lastActivityDate && prev.lastActivityDate !== today && prev.lastActivityDate !== yesterday;
    if (prev.lastActivityDate === today) {
      current = prev.current; // already counted for today
    } else if (prev.lastActivityDate === yesterday) {
      current = prev.current + 1;
    } else {
      current = 1;
    }

    const daily = {
      current,
      longest: Math.max(prev.longest || 0, current),
      lastActivityDate: today
    };

    const updatedStats = {
      ...userStats,
      streaks: { ...userStats.streaks, daily }
    };

    // Daily streak achievements
    const addIds = [];
    if (daily.current >= 3 && !userStats.achievements.includes(ACHIEVEMENTS.DAILY_STREAK_3.id)) addIds.push(ACHIEVEMENTS.DAILY_STREAK_3.id);
    if (daily.current >= 7 && !userStats.achievements.includes(ACHIEVEMENTS.DAILY_STREAK_7.id)) addIds.push(ACHIEVEMENTS.DAILY_STREAK_7.id);
    if (daily.current >= 30 && !userStats.achievements.includes(ACHIEVEMENTS.DAILY_STREAK_30.id)) addIds.push(ACHIEVEMENTS.DAILY_STREAK_30.id);
    if (addIds.length > 0) {
      updatedStats.achievements = [...userStats.achievements, ...addIds];
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    // Award XP after save
    for (const id of addIds) {
      await awardXP(ACHIEVEMENTS[id.toUpperCase()]?.xp || ACHIEVEMENTS[id]?.xp || 0, 'streak');
    }
    if (broken && prev.current > 0) emit('streak_reset', { type: 'daily', previous: prev.current });
    emit('streak_updated', { type: 'daily', current: daily.current, longest: daily.longest });
    if (addIds.length) emit('achievements_unlocked', { ids: addIds.map(id => ACHIEVEMENTS[id]) });
  };

  const updateTaskStreak = async () => {
    const today = dateKey();
    const yesterday = previousDateKey();
    const prev = userStats.streaks?.tasks || { current: 0, longest: 0, lastCompletionDate: null };

    let current = prev.current;
    const broken = prev.lastCompletionDate && prev.lastCompletionDate !== today && prev.lastCompletionDate !== yesterday;
    if (prev.lastCompletionDate === today) {
      current = prev.current; // already counted for today
    } else if (prev.lastCompletionDate === yesterday) {
      current = prev.current + 1;
    } else {
      current = 1;
    }

    const tasks = {
      current,
      longest: Math.max(prev.longest || 0, current),
      lastCompletionDate: today
    };

    const updatedStats = {
      ...userStats,
      streaks: { ...userStats.streaks, tasks }
    };

    // Task streak achievements
    if (tasks.current >= 3 && !userStats.achievements.includes(ACHIEVEMENTS.TASK_STREAK_3.id)) {
      updatedStats.achievements = [...(updatedStats.achievements || userStats.achievements), ACHIEVEMENTS.TASK_STREAK_3.id];
    }
    if (tasks.current >= 7 && !userStats.achievements.includes(ACHIEVEMENTS.TASK_STREAK_7.id)) {
      updatedStats.achievements = [...(updatedStats.achievements || userStats.achievements), ACHIEVEMENTS.TASK_STREAK_7.id];
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    // Award XP after save
    if (tasks.current >= 3 && userStats.achievements.indexOf(ACHIEVEMENTS.TASK_STREAK_3.id) === -1) await awardXP(ACHIEVEMENTS.TASK_STREAK_3.xp, 'streak');
    if (tasks.current >= 7 && userStats.achievements.indexOf(ACHIEVEMENTS.TASK_STREAK_7.id) === -1) await awardXP(ACHIEVEMENTS.TASK_STREAK_7.xp, 'streak');
    if (broken && prev.current > 0) emit('streak_reset', { type: 'task', previous: prev.current });
    emit('streak_updated', { type: 'task', current: tasks.current, longest: tasks.longest });
    const unlocked = [];
    if (tasks.current >= 3 && !userStats.achievements.includes(ACHIEVEMENTS.TASK_STREAK_3.id)) unlocked.push(ACHIEVEMENTS.TASK_STREAK_3);
    if (tasks.current >= 7 && !userStats.achievements.includes(ACHIEVEMENTS.TASK_STREAK_7.id)) unlocked.push(ACHIEVEMENTS.TASK_STREAK_7);
    if (unlocked.length) emit('achievements_unlocked', { ids: unlocked });
  };

  const updateHabitStreak = async (habitId) => {
    if (!habitId) return;
    const today = dateKey();
    const yesterday = previousDateKey();
    const prev = userStats.streaks?.habits?.[habitId] || { current: 0, longest: 0, lastCompletionDate: null };

    let current = prev.current;
    const broken = prev.lastCompletionDate && prev.lastCompletionDate !== today && prev.lastCompletionDate !== yesterday;
    if (prev.lastCompletionDate === today) {
      current = prev.current; // already counted for today
    } else if (prev.lastCompletionDate === yesterday) {
      current = prev.current + 1;
    } else {
      current = 1;
    }

    const habitEntry = {
      current,
      longest: Math.max(prev.longest || 0, current),
      lastCompletionDate: today
    };

    const updatedStats = {
      ...userStats,
      streaks: {
        ...userStats.streaks,
        habits: { ...(userStats.streaks?.habits || {}), [habitId]: habitEntry }
      }
    };

    // Habit streak achievement (7)
    if (habitEntry.current >= 7 && !userStats.achievements.includes(ACHIEVEMENTS.HABIT_STREAK_7.id)) {
      updatedStats.achievements = [...(updatedStats.achievements || userStats.achievements), ACHIEVEMENTS.HABIT_STREAK_7.id];
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    if (habitEntry.current >= 7 && userStats.achievements.indexOf(ACHIEVEMENTS.HABIT_STREAK_7.id) === -1) await awardXP(ACHIEVEMENTS.HABIT_STREAK_7.xp, 'streak');
    if (broken && prev.current > 0) emit('streak_reset', { type: 'habit', habitId, previous: prev.current });
    emit('streak_updated', { type: 'habit', habitId, current: habitEntry.current, longest: habitEntry.longest });
    if (habitEntry.current >= 7 && !userStats.achievements.includes(ACHIEVEMENTS.HABIT_STREAK_7.id)) emit('achievements_unlocked', { ids: [ACHIEVEMENTS.HABIT_STREAK_7] });
  };

  const updateStreaks = async (type, habitId = null) => {
    if (type === 'task') {
      await updateTaskStreak();
      await updateDailyStreak();
    } else if (type === 'habit') {
      await updateHabitStreak(habitId);
      await updateDailyStreak();
    } else if (type === 'daily') {
      await updateDailyStreak();
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
      await updateStreaks('habit', habit?.id);
    }
  };

  // Track pomodoro session
  const trackPomodoroSession = async () => {
    const updatedStats = {
      ...userStats,
      pomodoroSessions: userStats.pomodoroSessions + 1
    };

    // Check for pomodoro achievement (25 sessions)
    const pomodoroAchievement = ACHIEVEMENTS.POMODORO_MASTER;
    if (
      updatedStats.pomodoroSessions >= 25 &&
      !userStats.achievements.includes(pomodoroAchievement.id)
    ) {
      updatedStats.achievements = [...updatedStats.achievements, pomodoroAchievement.id];
      await awardXP(pomodoroAchievement.xp, 'achievement');
    }

    setUserStats(updatedStats);
    await saveUserStats(updatedStats);
    await awardXP(25, 'pomodoro');
    await updateStreaks('daily');
  };

  const value = {
    userStats,
    loading,
    awardXP,
    spendXP,
    purchaseLand,
    buildHouseStage,
    addDecorToInventory,
    placeDecor,
    updateDecorPosition,
    removeDecor,
    updateDecorScale,
    checkAchievements,
    trackTaskCompletion,
    trackHabitCompletion,
    trackPomodoroSession,
    updateStreaks,
    updateDailyStreak,
    updateTaskStreak,
    updateHabitStreak,
    canUseWeeklyPass,
    useWeeklyPass,
    canUndoWeeklyPass,
    undoWeeklyPass,
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
