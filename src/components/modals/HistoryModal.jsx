import { useEffect, useState } from 'react';
import { collection, doc, getDocs, getDoc, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import './Modal.css';

function dateKey(d) { return d.toISOString().slice(0,10); }

export default function HistoryModal({ open, onClose }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      // Firestore subcollection 'days' doesn't support orderBy on doc id directly with getDocs; we’ll pull last 30 by iterating recent dates.
      const results = [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = dateKey(d);
        const ref = doc(db, 'users', user.uid, 'days', key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];
          const total = tasks.length || 0;
          const done = tasks.filter(t => t.done).length;
          results.push({ key, date: d, total, done, notes: data.notes || '' });
        }
      }
      setItems(results);
    })();
  }, [open, user]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fas fa-history"></i> Geçmiş</h3>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <p style={{ color: 'var(--gray-500)' }}>Kayıt bulunamadı.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '60vh', overflow: 'auto' }}>
              {items.map((it) => (
                <li key={it.key} className="achievement-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{new Date(it.key).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    {it.notes ? <div style={{ color: 'var(--gray-600)', marginTop: 4 }}>{it.notes.slice(0, 120)}{it.notes.length > 120 ? '…' : ''}</div> : null}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{it.done}/{it.total}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
