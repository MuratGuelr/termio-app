import { useAuth } from '../contexts/AuthContext';
import './Header.css';

export default function Header({ onToggleTheme, onOpenHistory, isEditing, onToggleEdit }) {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>🎯 Günlük Gelişim</h1>
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
          <button className="theme-toggle" onClick={onToggleTheme} title="Tema Değiştir">
            <i className="fas fa-moon" id="themeIcon"></i>
          </button>
          <button className="theme-toggle" title="Gelişimi Paylaş">
            <i className="fas fa-share-alt"></i>
          </button>
          <button className="theme-toggle" title="Veriyi Dışa Aktar (JSON)">
            <i className="fas fa-file-export"></i>
          </button>
          <div className="user-info" id="userInfo">
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
