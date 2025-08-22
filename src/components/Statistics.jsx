import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Statistics.css';
import ActivityCalendar from './ActivityCalendar';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function dateKey(d) {
  // Istanbul day cutoff at 02:00 local time: subtract 2h before formatting
  const t = new Date(d);
  t.setHours(t.getHours() - 2);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLastNDays(n) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

export default function Statistics() {
  const { user } = useAuth();
  const [series, setSeries] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]); // aligns with series indices
  const [dailyMap, setDailyMap] = useState(new Map()); // key -> { data, date }
  const [counts, setCounts] = useState({ tasks: 13, habits: 4 });
  const [showCalendar, setShowCalendar] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'workdays' | 'weekends'
  const [onlyWithPomodoro, setOnlyWithPomodoro] = useState(false);

  // Subscribe to settings to get live task/habit counts for correct denominators
  useEffect(() => {
    if (!user) return;
    const tasksRef = doc(db, 'users', user.uid, 'settings', 'tasks');
    const habitsRef = doc(db, 'users', user.uid, 'settings', 'habits');
    const unsubs = [];

    const applyCounts = async () => {
      // Prime counts once
      const [tSnap, hSnap] = await Promise.all([getDoc(tasksRef), getDoc(habitsRef)]);
      setCounts({
        tasks: Array.isArray(tSnap.data()?.tasks) ? tSnap.data().tasks.length : counts.tasks,
        habits: Array.isArray(hSnap.data()?.habits) ? hSnap.data().habits.length : counts.habits,
      });
    };
    applyCounts();

    unsubs.push(onSnapshot(tasksRef, (snap) => {
      const len = Array.isArray(snap.data()?.tasks) ? snap.data().tasks.length : null;
      setCounts(prev => ({ ...prev, tasks: len ?? prev.tasks }));
    }));
    unsubs.push(onSnapshot(habitsRef, (snap) => {
      const len = Array.isArray(snap.data()?.habits) ? snap.data().habits.length : null;
      setCounts(prev => ({ ...prev, habits: len ?? prev.habits }));
    }));

    return () => { unsubs.forEach(u => { try { u(); } catch (_) {} }); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const days = getLastNDays(7);
    const keys = days.map(dateKey);
    const valuesMap = new Map(keys.map(k => [k, 0]));
    const bdMap = new Map(); // key -> breakdown
    const unsubs = [];

    const computePercent = (data) => {
      if (!data) return 0;
      // Weekly pass day counts as 100% for analytics
      if (data.passUsed) return 100;
      // Derive task percent
      let taskPct;
      if (Array.isArray(data.completedTasks)) {
        const totalTasks = (typeof data.totalTasks === 'number' ? data.totalTasks : counts.tasks) || 1;
        taskPct = Math.round((data.completedTasks.length / totalTasks) * 100);
      } else if (typeof data.taskProgress === 'number') {
        // Fallback to stored percent if arrays not present
        taskPct = Math.max(0, Math.min(100, Math.round(data.taskProgress)));
      } else if (Array.isArray(data.tasks)) {
        const tasks = data.tasks;
        const total = tasks.length || 1;
        const done = tasks.filter(t => t.done).length;
        taskPct = Math.round((done / total) * 100);
      } else {
        taskPct = 0;
      }

      // Derive habit percent
      let habitPct = 0;
      if (Array.isArray(data.completedHabits)) {
        const totalHabits = (typeof data.totalHabits === 'number' ? data.totalHabits : counts.habits) || 1;
        habitPct = Math.round((data.completedHabits.length / totalHabits) * 100);
      } else if (typeof data.habitProgress === 'number') {
        habitPct = Math.max(0, Math.min(100, Math.round(data.habitProgress)));
      }

      // Weighted by counts if available
      const tCount = counts.tasks || 0;
      const hCount = counts.habits || 0;
      const totalCount = tCount + hCount;
      if (totalCount > 0) {
        const combined = Math.round(((taskPct * tCount) + (habitPct * hCount)) / totalCount);
        return Math.max(0, Math.min(100, combined));
      }
      return Math.max(0, Math.min(100, taskPct));
    };

    // Prime initial values via one-time fetch and populate dailyMap for filtering/tooltip
    (async () => {
      const initial = [];
      const initBD = [];
      const newDaily = new Map();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const ref = doc(db, 'users', user.uid, 'days', k);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        const percent = data ? computePercent(data) : 0;
        valuesMap.set(k, percent);
        initial.push(percent);
        // breakdown counts
        const taskTotal = typeof data?.totalTasks === 'number' ? data.totalTasks : (Array.isArray(data?.tasks) ? data.tasks.length : counts.tasks);
        const taskDone = Array.isArray(data?.completedTasks) ? data.completedTasks.length : (Array.isArray(data?.tasks) ? data.tasks.filter(t => t.done).length : 0);
        const habitTotal = typeof data?.totalHabits === 'number' ? data.totalHabits : counts.habits;
        const habitDone = Array.isArray(data?.completedHabits) ? data.completedHabits.length : 0;
        initBD.push({ task: { done: taskDone || 0, total: taskTotal || 0 }, habit: { done: habitDone || 0, total: habitTotal || 0 } });
        newDaily.set(k, { data, date: days[i] });
      }
      setSeries(initial);
      setBreakdowns(initBD);
      setDailyMap(newDaily);
    })();

    // Subscribe for live updates
    for (const k of keys) {
      const ref = doc(db, 'users', user.uid, 'days', k);
      const unsub = onSnapshot(ref, (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const percent = data ? computePercent(data) : 0;
        valuesMap.set(k, percent);
        // Keep order by keys array for series and breakdowns
        setSeries(keys.map(key => valuesMap.get(key) ?? 0));
        setBreakdowns(keys.map((key, idx) => {
          const d = key === k ? data : dailyMap.get(key)?.data;
          const taskTotal = typeof d?.totalTasks === 'number' ? d.totalTasks : (Array.isArray(d?.tasks) ? d.tasks.length : counts.tasks);
          const taskDone = Array.isArray(d?.completedTasks) ? d.completedTasks.length : (Array.isArray(d?.tasks) ? d.tasks.filter(t => t.done).length : 0);
          const habitTotal = typeof d?.totalHabits === 'number' ? d.totalHabits : counts.habits;
          const habitDone = Array.isArray(d?.completedHabits) ? d.completedHabits.length : 0;
          return { task: { done: taskDone || 0, total: taskTotal || 0 }, habit: { done: habitDone || 0, total: habitTotal || 0 } };
        }));
        setDailyMap(prev => new Map(prev).set(k, { data, date: days[keys.indexOf(k)] }));
      });
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach(u => {
        try { u(); } catch (_) {}
      });
    };
  }, [user, counts.tasks, counts.habits]);

  // Derive labels/series according to filters
  const { labels, filteredSeries, filteredBreakdowns, filteredPassFlags } = useMemo(() => {
    const last7 = getLastNDays(7);
    const keys = last7.map(dateKey);
    const lab = [];
    const s = [];
    const b = [];
    const p = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const info = dailyMap.get(k);
      const dateObj = info?.date || last7[i];
      const day = dateObj.getDay(); // 0=Sun
      const isWeekend = day === 0 || day === 6;
      // filter by workday/weekend
      if (filterMode === 'workdays' && isWeekend) continue;
      if (filterMode === 'weekends' && !isWeekend) continue;
      // filter by pomodoro presence if requested
      if (onlyWithPomodoro) {
        const d = info?.data;
        const hasPomo = (Array.isArray(d?.pomodoroSessions) && d.pomodoroSessions.length > 0)
          || (typeof d?.pomodoroCount === 'number' && d.pomodoroCount > 0)
          || (typeof d?.pomodoros === 'number' && d.pomodoros > 0);
        if (!hasPomo) continue;
      }
      lab.push(dateObj.toLocaleDateString('tr-TR', { weekday: 'short' }));
      s.push(series[i] ?? 0);
      b.push(breakdowns[i] ?? { task: { done: 0, total: 0 }, habit: { done: 0, total: 0 } });
      p.push(Boolean(info?.data?.passUsed));
    }
    return { labels: lab, filteredSeries: s, filteredBreakdowns: b, filteredPassFlags: p };
  }, [dailyMap, series, breakdowns, filterMode, onlyWithPomodoro]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Görev Tamamlama (%)',
          data: filteredSeries,
          fill: false,
          borderColor: '#6366f1',
          backgroundColor: '#8b5cf6',
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    }),
    [labels, filteredSeries]
  );

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const bd = filteredBreakdowns[idx];
            const pct = ctx.parsed.y ?? 0;
            const t = bd?.task || { done: 0, total: 0 };
            const h = bd?.habit || { done: 0, total: 0 };
            const pass = filteredPassFlags?.[idx];
            const suffix = pass ? ' • Günlük geçiş' : '';
            return ` %${pct} (Görev: ${t.done}/${t.total}, Alışkanlık: ${h.done}/${h.total})${suffix}`;
          },
        },
      },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
  };

  return (
    <div className="card" id="statsSection">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-chart-line"></i>
          Detaylı İstatistikler
        </h3>
        <button className="icon-btn" onClick={() => setShowCalendar(true)} title="Aktivite Takvimi">
          <i className="fas fa-calendar-alt"></i>
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-number" id="totalDays">7</span>
          <div className="stat-label">Son 7 Gün</div>
        </div>
        <div className="stat-item">
          <span className="stat-number" id="avgCompletion">
            {filteredSeries.length ? Math.round(filteredSeries.reduce((a, b) => a + b, 0) / filteredSeries.length) : 0}%
          </span>
          <div className="stat-label">Ortalama Tamamlama</div>
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div className="seg-toggle-group">
            <button
              className={`chip ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
              title="Tümü"
            >Tümü</button>
            <button
              className={`chip ${filterMode === 'workdays' ? 'active' : ''}`}
              onClick={() => setFilterMode('workdays')}
              title="Hafta içi"
            >Hafta içi</button>
            <button
              className={`chip ${filterMode === 'weekends' ? 'active' : ''}`}
              onClick={() => setFilterMode('weekends')}
              title="Hafta sonu"
            >Hafta sonu</button>
          </div>
          <label className="chip" style={{ cursor: 'pointer' }} title="Sadece Pomodoro içeren günler">
            <input type="checkbox" checked={onlyWithPomodoro} onChange={e => setOnlyWithPomodoro(e.target.checked)} style={{ marginRight: 8 }} />
            Sadece Pomodoro
          </label>
        </div>
        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
          <i className="fas fa-chart-bar"></i> Haftalık İlerleme Grafiği
        </h4>
        <Line data={data} options={options} />
      </div>
      {showCalendar && (
        <ActivityCalendar onClose={() => setShowCalendar(false)} />
      )}
    </div>
  );
}
