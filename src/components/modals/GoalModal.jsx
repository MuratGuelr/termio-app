import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import './Modal.css';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function GoalModal({ open, onClose }) {
  const { user } = useAuth();
  const [goalName, setGoalName] = useState('');
  const [goalFrequency, setGoalFrequency] = useState('weekly');
  const [goals, setGoals] = useState({
    weekly: [],
    monthly: [],
    yearly: []
  });

  useEffect(() => {
    if (open && user) {
      loadGoals();
    }
  }, [open, user]);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().goals) {
        setGoals(docSnap.data().goals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const addGoal = async () => {
    if (!goalName.trim() || !user) return;

    const newGoal = {
      id: Date.now().toString(),
      name: goalName.trim(),
      createdAt: new Date().toISOString(),
      completed: false
    };

    const updatedGoals = {
      ...goals,
      [goalFrequency]: [...goals[goalFrequency], newGoal]
    };

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { goals: updatedGoals }, { merge: true });
      setGoals(updatedGoals);
      setGoalName('');
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Hedef eklenirken bir hata oluştu.');
    }
  };

  const deleteGoal = async (frequency, goalId) => {
    const updatedGoals = {
      ...goals,
      [frequency]: goals[frequency].filter(goal => goal.id !== goalId)
    };

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { goals: updatedGoals }, { merge: true });
      setGoals(updatedGoals);
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="modal show" id="goalModal">
      <div className="modal-content">
        <div className="modal-header">
          <h3><i className="fas fa-bullseye"></i> Yeni Hedef Ekle</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="goal-form">
          <input 
            type="text" 
            id="goalName" 
            placeholder="Hedef adı (örn: Projeyi Bitir)" 
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            style={{
              width: '100%', 
              padding: '0.75rem', 
              border: '1px solid var(--gray-200)', 
              borderRadius: '8px', 
              marginBottom: '1rem', 
              fontSize: '1rem', 
              background: 'var(--light)', 
              color: 'var(--dark)'
            }}
          />
          <select 
            id="goalFrequency" 
            value={goalFrequency}
            onChange={(e) => setGoalFrequency(e.target.value)}
            style={{
              width: '100%', 
              padding: '0.75rem', 
              border: '1px solid var(--gray-200)', 
              borderRadius: '8px', 
              marginBottom: '1rem', 
              fontSize: '1rem', 
              background: 'var(--light)', 
              color: 'var(--dark)'
            }}
          >
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
            <option value="yearly">Yıllık</option>
          </select>
          <button className="save-btn" onClick={addGoal}>Hedefi Ekle</button>
        </div>
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--gray-200)' }}>
          <h4>Mevcut Hedefler</h4>
          <ul id="currentGoalsList" style={{ listStyle: 'none', padding: 0 }}>
            {Object.entries(goals).map(([frequency, goalList]) => (
              goalList.map(goal => (
                <li key={goal.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.75rem',
                  margin: '0.5rem 0',
                  background: 'var(--gray-50)',
                  borderRadius: '8px',
                  border: '1px solid var(--gray-200)'
                }}>
                  <span>
                    <strong>{goal.name}</strong> ({frequency === 'weekly' ? 'Haftalık' : frequency === 'monthly' ? 'Aylık' : 'Yıllık'})
                  </span>
                  <button 
                    onClick={() => deleteGoal(frequency, goal.id)}
                    style={{
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Sil
                  </button>
                </li>
              ))
            ))}
            {Object.values(goals).every(arr => arr.length === 0) && (
              <li style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>
                Henüz hedef eklenmedi.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
