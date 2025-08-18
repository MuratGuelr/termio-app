import './MobileNav.css';

export default function MobileNav({ onToggleTheme }) {
  return (
    <nav className="mobile-nav">
      <a href="#homeSection" className="mobile-nav-item active">
        <i className="fas fa-home"></i>
        <span>Ana Sayfa</span>
      </a>
      <a href="#tasksSection" className="mobile-nav-item">
        <i className="fas fa-tasks"></i>
        <span>Görevler</span>
      </a>
      <a href="#habitsSection" className="mobile-nav-item">
        <i className="fas fa-star"></i>
        <span>Alışkanlıklar</span>
      </a>
      <a href="#statsSection" className="mobile-nav-item">
        <i className="fas fa-chart-line"></i>
        <span>İstatistik</span>
      </a>
      <a className="mobile-nav-item" onClick={onToggleTheme}>
        <i className="fas fa-moon" id="mobileThemeIcon"></i>
        <span id="mobileThemeText">Gece Modu</span>
      </a>
    </nav>
  );
}
