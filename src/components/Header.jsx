import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';
import './Header.css';

export default function Header({ onToggleTheme, onOpenHistory, isEditing, onToggleEdit, onOpenSettings, onOpenAchievements }) {
  const { user, logout } = useAuth();
  const { userStats } = useGamification();
  const dailyStreak = userStats?.streaks?.daily?.current || 0;
  const rank = userStats?.rank || { name: 'Novice', icon: '🐣' };
  const [rankOpen, setRankOpen] = useState(false);
  const rankRef = useRef(null);

  // Local rank thresholds (mirror of GamificationContext)
  const RANKS = useMemo(() => ([
    { minLevel: 1, name: 'Novice', icon: '🐣' },
    { minLevel: 5, name: 'Bronz', icon: '🥉' },
    { minLevel: 10, name: 'Gümüş', icon: '🥈' },
    { minLevel: 15, name: 'Altın', icon: '🥇' },
    { minLevel: 20, name: 'Elmas', icon: '💎' },
    { minLevel: 30, name: 'Usta', icon: '🏆' }
  ]), []);

  const currentLevel = userStats?.level || 1;
  const currentXP = userStats?.xp || 0;
  const currentIndex = Math.max(0, RANKS.findIndex(r => r.name === rank.name));
  const nextRank = RANKS[currentIndex + 1] || null;
  const currentMin = RANKS[currentIndex]?.minLevel || 1;
  const nextMin = nextRank?.minLevel || currentMin;
  const levelProgressToNext = nextRank ? Math.min(1, Math.max(0, (currentLevel - currentMin) / (nextMin - currentMin))) : 1;

  // XP needed to reach a given level L: threshold = (L-1)^2 * 100
  const targetXPForLevel = (L) => ((L - 1) * (L - 1)) * 100;
  const targetXPNextRank = nextRank ? targetXPForLevel(nextRank.minLevel) : null;
  const remainingXPToNextRank = nextRank ? Math.max(0, targetXPNextRank - currentXP) : 0;

  useEffect(() => {
    if (!rankOpen) return;
    const onDown = (e) => {
      if (rankRef.current && !rankRef.current.contains(e.target)) setRankOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setRankOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [rankOpen]);

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>🎯 Termio</h1>
        </div>
        <div className="header-center">
          <button 
            className={`edit-mode-btn ${isEditing ? 'active' : ''}`} 
            onClick={onToggleEdit}
            title="Düzenleme Modu"
          >
            <i className="fas fa-edit"></i>
            {isEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}
          </button>
        </div>
        <div className="header-right">
          <div className="rank-wrap" ref={rankRef}>
            <button
              className="rank-badge"
              type="button"
              onClick={() => setRankOpen(v => !v)}
              title={`Rütbe: ${rank.name}`}
              aria-label={`Rütbeniz ${rank.name}`}
              aria-expanded={rankOpen}
              aria-haspopup="dialog"
            >
              <span className="rank-icon" aria-hidden="true">{rank.icon}</span>
              <span className="rank-name">{rank.name}</span>
            </button>
            {rankOpen && (
              <div className="rank-popover" role="dialog" aria-label="Rütbe Detayları">
                <div className="rank-popover-header">
                  <span className="rank-popover-title">Rütbe</span>
                  <span className="rank-popover-current">{rank.icon} {rank.name}</span>
                </div>
                {nextRank ? (
                  <div className="rank-popover-body">
                    <div className="rank-next">Sonraki: {nextRank.icon} {nextRank.name} (Lvl {nextRank.minLevel})</div>
                    <div className="rank-progress">
                      <div className="rank-progress-bar" style={{ width: `${Math.round(levelProgressToNext*100)}%` }} />
                    </div>
                    <div className="rank-meta">
                      <span>Seviyen: {currentLevel}</span>
                      <span>Kalan seviye: {Math.max(0, nextMin - currentLevel)}</span>
                    </div>
                    <div className="rank-meta">
                      <span>XP: {currentXP}</span>
                      <span>Sonraki rütbeye kalan XP: {remainingXPToNextRank}</span>
                    </div>
                    <div className="rank-actions">
                      <button type="button" className="btn-link" onClick={() => { setRankOpen(false); onOpenAchievements?.(); }}>Achievements'ı Aç</button>
                    </div>
                  </div>
                ) : (
                  <div className="rank-popover-body">
                    <div className="rank-next">En yüksek rütbedesin! {rank.icon}</div>
                    <div className="rank-actions">
                      <button type="button" className="btn-link" onClick={() => { setRankOpen(false); onOpenAchievements?.(); }}>Achievements'ı Aç</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            className="streak-pill"
            title={`Günlük seri: ${dailyStreak}`}
            aria-label={`Günlük seri ${dailyStreak}`}
            onClick={onOpenAchievements}
          >
            <span className="streak-emoji" aria-hidden="true">🔥</span>
            <span className="streak-count">x{dailyStreak}</span>
          </button>
          <button className="theme-toggle" onClick={onToggleTheme} title="Tema Değiştir">
            <i className="fas fa-moon" id="themeIcon"></i>
          </button>
          <button className="theme-toggle" title="Gelişimi Paylaş">
            <i className="fas fa-share-alt"></i>
          </button>
          <button className="theme-toggle" title="Veriyi Dışa Aktar (JSON)">
            <i className="fas fa-file-export"></i>
          </button>
          <div className="user-info" id="userInfo" role="button" tabIndex={0} onClick={onOpenSettings} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenSettings?.()} title="Ayarlar">
            <div className="user-avatar" id="userAvatar">
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span id="userName">{user?.displayName || 'User'}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Çıkış Yap">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
