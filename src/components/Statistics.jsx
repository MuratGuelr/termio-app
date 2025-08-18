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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Statistics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function dateKey(d) {
  return d.toISOString().slice(0, 10);
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const days = getLastNDays(7);
      const results = [];
      for (const d of days) {
        const key = dateKey(d);
        const ref = doc(db, 'users', user.uid, 'days', key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];
          const total = tasks.length || 1;
          const done = tasks.filter(t => t.done).length;
          results.push(Math.round((done / total) * 100));
        } else {
          results.push(0);
        }
      }
      setSeries(results);
    })();
  }, [user]);

  const labels = useMemo(
    () => getLastNDays(7).map(d => d.toLocaleDateString('tr-TR', { weekday: 'short' })),
    []
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Görev Tamamlama (%)',
          data: series,
          fill: false,
          borderColor: '#6366f1',
          backgroundColor: '#8b5cf6',
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    }),
    [labels, series]
  );

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
  };

  return (
    <div className="card" id="statsSection">
      <h3>
        <i className="fas fa-chart-line"></i>
        Detaylı İstatistikler
      </h3>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-number" id="totalDays">7</span>
          <div className="stat-label">Son 7 Gün</div>
        </div>
        <div className="stat-item">
          <span className="stat-number" id="avgCompletion">
            {series.length ? Math.round(series.reduce((a, b) => a + b, 0) / series.length) : 0}%
          </span>
          <div className="stat-label">Ortalama Tamamlama</div>
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
          <i className="fas fa-chart-bar"></i> Haftalık İlerleme Grafiği
        </h4>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
