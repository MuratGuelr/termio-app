import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Goals.css';

const defaultGoals = [];

export default function Goals({ onOpenGoalModal }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState({
    weekly: [],
    monthly: [],
    yearly: []
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().goals) {
        setGoals(docSnap.data().goals);
      }
    })();
  }, [user]);

  const persistGoals = async (updatedGoals) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { goals: updatedGoals }, { merge: true });
  };

  const totalGoals = Object.values(goals).flat().length;
  const completedGoals = Object.values(goals).flat().filter(g => g.completed).length;

  return (
    <div className="card">
      <h3>
        <i className="fas fa-bullseye"></i>
        Hedeflerim
      </h3>
      <div className="goals-summary">
        <div className="stat-item">
          <span className="stat-number">{completedGoals}/{totalGoals}</span>
          <div className="stat-label">Tamamlanan Hedefler</div>
        </div>
      </div>
      <div className="goals-categories">
        {Object.entries(goals).map(([frequency, goalList]) => (
          <div key={frequency} className="goal-category">
            <h4>
              {frequency === 'weekly' ? '📅 Haftalık' : 
               frequency === 'monthly' ? '📆 Aylık' : 
               '🗓️ Yıllık'}
            </h4>
            {goalList.length === 0 ? (
              <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Henüz {frequency === 'weekly' ? 'haftalık' : frequency === 'monthly' ? 'aylık' : 'yıllık'} hedef yok
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {goalList.map((goal) => (
                  <li key={goal.id} className={`goal-item ${goal.completed ? 'completed' : ''}`}>
                    <div className="goal-checkbox">
                      {goal.completed && <i className="fas fa-check"></i>}
                    </div>
                    <span className="goal-text">{goal.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <button className="save-btn" onClick={onOpenGoalModal}>
        <i className="fas fa-plus"></i> Yeni Hedef Ekle
      </button>
    </div>
  );
}
