import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './ActivityCalendar.css';

function fmtKey(d) {
  // Istanbul day cutoff at 02:00 local time: subtract 2h before formatting
  const t = new Date(d);
  t.setHours(t.getHours() - 2);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export default function ActivityCalendar({ onClose }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState([]); // [{date, key, percent, data}]
  const [loading, setLoading] = useState(false);
  const [tasksMap, setTasksMap] = useState({}); // id -> name
  const [habitsMap, setHabitsMap] = useState({}); // id -> name
  const [selected, setSelected] = useState(null); // day obj

  // Build month grid
  const monthGrid = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const startWeekday = (start.getDay() + 6) % 7; // make Monday=0
    const totalDays = end.getDate();

    const cells = [];
    // leading blanks
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    // pad trailing to complete weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const computePercent = (data) => {
    if (!data) return 0;
    // Weekly pass day counts as 100% for visualization
    if (data.passUsed) return 100;
    // Prefer arrays with totals
    let taskPct = 0;
    if (Array.isArray(data.completedTasks)) {
      const totalTasks = (typeof data.totalTasks === 'number' ? data.totalTasks : (data.tasks?.length || 0)) || 1;
      taskPct = Math.round((data.completedTasks.length / totalTasks) * 100);
    } else if (typeof data.taskProgress === 'number') {
      taskPct = Math.max(0, Math.min(100, Math.round(data.taskProgress)));
    } else if (Array.isArray(data.tasks)) {
      const total = data.tasks.length || 1;
      const done = data.tasks.filter(t => t.done).length;
      taskPct = Math.round((done / total) * 100);
    }

    let habitPct = 0;
    if (Array.isArray(data.completedHabits)) {
      const totalHabits = (typeof data.totalHabits === 'number' ? data.totalHabits : 0) || 1;
      habitPct = Math.round((data.completedHabits.length / totalHabits) * 100);
    } else if (typeof data.habitProgress === 'number') {
      habitPct = Math.max(0, Math.min(100, Math.round(data.habitProgress)));
    }

    const tCount = (typeof data.totalTasks === 'number' ? data.totalTasks : 0) || 0;
    const hCount = (typeof data.totalHabits === 'number' ? data.totalHabits : 0) || 0;
    const totalCount = tCount + hCount;
    if (totalCount > 0) {
      return Math.round(((taskPct * tCount) + (habitPct * hCount)) / totalCount);
    }
    return Math.round(taskPct);
  };

  // Load settings maps once
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [tSnap, hSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid, 'settings', 'tasks')),
          getDoc(doc(db, 'users', user.uid, 'settings', 'habits')),
        ]);
        const tArr = Array.isArray(tSnap.data()?.tasks) ? tSnap.data().tasks : [];
        const hArr = Array.isArray(hSnap.data()?.habits) ? hSnap.data().habits : [];
        const tMap = {};
        tArr.forEach(t => { tMap[t.id] = t.activity || t.name || t.id; });
        const hMap = {};
        hArr.forEach(h => { hMap[h.id] = h.name || h.id; });
        setTasksMap(tMap);
        setHabitsMap(hMap);
      } catch (e) {
        // ignore
      }
    })();
  }, [user]);

  // Load month data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const promises = monthGrid.map(async (cell) => {
        if (!cell) return null;
        const key = fmtKey(cell);
        const snap = await getDoc(doc(db, 'users', user.uid, 'days', key));
        if (!snap.exists()) return { date: cell, key, percent: 0, data: null };
        const data = snap.data();
        return { date: cell, key, percent: computePercent(data), data };
      });
      const results = await Promise.all(promises);
      setDays(results);
      setLoading(false);
    };
    load();
  }, [user, month, monthGrid]);

  const monthLabel = useMemo(() => month.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }), [month]);

  const prevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const intensityClass = (pct) => {
    if (pct >= 90) return 'cell-5';
    if (pct >= 70) return 'cell-4';
    if (pct >= 50) return 'cell-3';
    if (pct >= 30) return 'cell-2';
    if (pct >= 10) return 'cell-1';
    return 'cell-0';
  };

  return (
    <div className="activity-calendar">
      <div className="calendar-header">
        {!selected && (
          <button className="icon-btn" onClick={prevMonth} aria-label="Önceki Ay"><i className="fas fa-chevron-left"></i></button>
        )}
        <div className="calendar-title">{monthLabel}</div>
        {!selected && (
          <>
            <button className="icon-btn" onClick={nextMonth} aria-label="Sonraki Ay"><i className="fas fa-chevron-right"></i></button>
            <button className="icon-btn close-btn" onClick={onClose} aria-label="Kapat"><i className="fas fa-times"></i></button>
          </>
        )}
      </div>

      <div className="weekday-row">
        {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(w => (
          <div key={w} className="weekday">{w}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {loading ? (
          <div className="loading">Yükleniyor…</div>
        ) : (
          monthGrid.map((cell, idx) => {
            if (!cell) return <div key={idx} className="day-cell empty" />;
            const key = fmtKey(cell);
            const dayData = days.find(d => d && d.key === key);
            const pct = dayData ? dayData.percent : 0;
            const dayNumber = cell.getDate();
            return (
              <button
                key={idx}
                className={`day-cell ${intensityClass(pct)}`}
                onClick={() => setSelected(dayData)}
                title={`${key} - %${pct}${dayData?.data?.passUsed ? ' • Günlük geçiş' : ''}`}
              >
                <span className="day-num">{dayNumber}</span>
                <span className="day-pct">%{pct}</span>
                {dayData?.data?.passUsed && (
                  <span
                    className="pass-badge"
                    aria-label="Günlük geçiş kullanıldı"
                    title="Günlük geçiş kullanıldı"
                    style={{ position: 'absolute', top: 4, right: 4, fontSize: 12 }}
                  >
                    🎟️
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {selected && (
        <div className="detail-panel" role="dialog" aria-modal="true">
          <div className="detail-header">
            {(() => {
              // Parse YYYY-MM-DD as LOCAL date to avoid UTC shift
              const [yy, mm, dd] = selected.key.split('-').map(Number);
              const d = new Date(yy, mm - 1, dd);
              return (
                <div className="detail-title">{d.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
              );
            })()}
            <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Kapat"><i className="fas fa-times"></i></button>
          </div>
          <div className="detail-content">
            <div className="detail-stat">Tamamlama: <strong>%{selected.percent}</strong></div>
            {selected.data ? (
              <>
                {(() => {
                  const completed = selected.data.completedTasks || [];
                  const total = typeof selected.data.totalTasks === 'number' ? selected.data.totalTasks : Object.keys(tasksMap).length;
                  return (
                    <div className="detail-section">
                      <div className="section-title"><i className="fas fa-tasks"></i> Görevler ({completed.length}/{total || 0})</div>
                      {completed.length ? (
                        <div className="chip-row">
                          {completed.map(id => (
                            <span key={id} className="chip"><span className="dot" />{tasksMap[id] || id}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="detail-empty">Tamamlanan görev yok</div>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const completed = selected.data.completedHabits || [];
                  const total = typeof selected.data.totalHabits === 'number' ? selected.data.totalHabits : Object.keys(habitsMap).length;
                  return (
                    <div className="detail-section">
                      <div className="section-title"><i className="fas fa-star"></i> Alışkanlıklar ({completed.length}/{total || 0})</div>
                      {completed.length ? (
                        <div className="chip-row">
                          {completed.map(id => (
                            <span key={id} className="chip"><span className="dot" />{habitsMap[id] || id}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="detail-empty">Tamamlanan alışkanlık yok</div>
                      )}
                    </div>
                  );
                })()}
                {selected.data.notes && (
                  <div className="detail-section">
                    <div className="section-title"><i className="fas fa-sticky-note"></i> Notlar</div>
                    <div className="notes">{selected.data.notes}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="detail-empty">Kayıt yok</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
