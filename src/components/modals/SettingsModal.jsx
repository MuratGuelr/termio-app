import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useGamification } from '../../contexts/GamificationContext';
import './SettingsModal.css';

export default function SettingsModal({ open, onClose, onToggleTheme, currentTheme }) {
  const { user, logout } = useAuth();
  const { canUseWeeklyPass, useWeeklyPass, canUndoWeeklyPass, undoWeeklyPass } = useGamification();
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);

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

  const handleUsePass = async () => {
    const elig = canUseWeeklyPass();
    if (!elig.ok) {
      alert(elig.reason === 'weekend_not_allowed' ? 'Günlük geçiş hakkı sadece hafta içi kullanılabilir.' : 'Bu hafta günlük geçiş hakkı zaten kullanıldı.');
      return;
    }
    if (!confirm('Bugünlük streak’i korumak için günlük hakkı kullanılsın mı? (XP verilmez)')) return;
    setWorking(true);
    try {
      const res = await useWeeklyPass();
      if (res?.ok) alert('Günlük geçiş hakkı kullanıldı!');
    } finally {
      setWorking(false);
    }
  };

  const handleUndoPass = async () => {
    const can = canUndoWeeklyPass();
    if (!can.ok) {
      alert('Bugün için geri alma mümkün değil.');
      return;
    }
    if (!confirm('Günlük hakkını geri almak istediğine emin misin?')) return;
    setWorking(true);
    try {
      const res = await undoWeeklyPass();
      if (res?.ok) alert('Günlük geçiş hakkı geri alındı.');
    } finally {
      setWorking(false);
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

        <div className="settings-section">
          <h3>Günlük Geçiş (Streak Hakkı)</h3>
          <p className="muted" style={{ marginTop: 4 }}>
            Gerçekten çok önemli bir şeyin varsa kullan; aksi halde kullanma (haftada 1 kez, XP verilmez).
          </p>
          {(() => {
            const useState = canUseWeeklyPass();
            const undoState = canUndoWeeklyPass();
            const reasonText = (r) => {
              if (!r) return '';
              switch (r) {
                case 'weekend_not_allowed': return 'Sadece hafta içi kullanılabilir.';
                case 'already_used_this_week': return 'Bu hafta zaten kullanıldı.';
                case 'not_used': return 'Bugün henüz kullanılmadı.';
                case 'different_week': return 'Farklı haftada kullanıldı.';
                case 'not_today': return 'Geri alma sadece aynı gün mümkün.';
                default: return '';
              }
            };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <div>
                  <button
                    className="btn"
                    onClick={handleUsePass}
                    disabled={working || !useState.ok}
                    title="Hafta içi, haftada 1 kez kullanılabilir."
                  >
                    🎟️ Bugün Önemli Bir İşim Çıktı
                  </button>
                  {!useState.ok && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {reasonText(useState.reason)}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    className="btn danger"
                    onClick={handleUndoPass}
                    disabled={working || !undoState.ok}
                    title="Yanlışlıkla kullandıysan bugünkü hakkı geri al."
                  >
                    Geri Al (Yanlışlıkla Kullandım)
                  </button>
                  {!undoState.ok && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {reasonText(undoState.reason)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="settings-actions">
          <button className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
