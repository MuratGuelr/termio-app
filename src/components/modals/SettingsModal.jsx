import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './SettingsModal.css';

export default function SettingsModal({ open, onClose, onToggleTheme, currentTheme }) {
  const { user, logout } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const resetTutorial = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
      await setDoc(ref, { completed: false, step: 0 }, { merge: true });
      // Hard refresh onboarding next load; optionally emit an event
    } finally {
      setSaving(false);
      onClose?.();
      // Force reload to pick up onboarding quickly (optional):
      // window.location.reload();
    }
  };

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Ayarlar</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="settings-section">
          <h3>Hesap</h3>
          <div className="user-row">
            <div className="avatar-lg">{user?.displayName?.[0]?.toUpperCase() || 'U'}</div>
            <div className="user-meta">
              <div className="name">{user?.displayName || 'User'}</div>
              <div className="email">{user?.email}</div>
            </div>
          </div>
          <button className="btn danger" onClick={logout}><i className="fas fa-sign-out-alt"></i> Çıkış Yap</button>
        </div>

        <div className="settings-section">
          <h3>Görünüm</h3>
          <div className="row">
            <span>Tema</span>
            <button className="btn" onClick={onToggleTheme}>
              {currentTheme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>Öğretici</h3>
          <button className="btn" onClick={resetTutorial} disabled={saving}>
            {saving ? 'Sıfırlanıyor…' : 'Tur (Onboarding) Sıfırla'}
          </button>
        </div>

        <div className="settings-actions">
          <button className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
