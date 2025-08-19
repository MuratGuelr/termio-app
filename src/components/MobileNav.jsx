import './MobileNav.css';
import { useState, useEffect } from 'react';

export default function MobileNav({ onToggleTheme }) {
  const [activeSection, setActiveSection] = useState('homeSection');

  // Custom smooth scroll function with slower speed
  const smoothScrollTo = (targetId) => {
    const element = document.getElementById(targetId.replace('#', ''));
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    const sectionId = targetId.replace('#', '');
    setActiveSection(sectionId);
    smoothScrollTo(targetId);
  };

  // Detect which section is currently visible
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['homeSection', 'tasksSection', 'habitsSection', 'statsSection'];
      const viewportHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      
      // Find the section that takes up the most viewport space
      let maxVisibleArea = 0;
      let mostVisibleSection = 'homeSection';

      sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top;
          const elementBottom = rect.bottom;
          
          // Calculate visible area of this section
          const visibleTop = Math.max(0, elementTop);
          const visibleBottom = Math.min(viewportHeight, elementBottom);
          const visibleArea = Math.max(0, visibleBottom - visibleTop);
          
          // If this section has more visible area, make it active
          if (visibleArea > maxVisibleArea) {
            maxVisibleArea = visibleArea;
            mostVisibleSection = sectionId;
          }
        }
      });
      
      // Only update if the section actually changed
      if (mostVisibleSection !== activeSection) {
        setActiveSection(mostVisibleSection);
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', throttledScroll);
  }, [activeSection]);

  return (
    <nav className="mobile-nav">
      <a 
        href="#homeSection" 
        className={`mobile-nav-item ${activeSection === 'homeSection' ? 'active' : ''}`}
        onClick={(e) => handleNavClick(e, '#homeSection')}
      >
        <i className="fas fa-home"></i>
        <span>Ana Sayfa</span>
      </a>
      <a 
        href="#tasksSection" 
        className={`mobile-nav-item ${activeSection === 'tasksSection' ? 'active' : ''}`}
        onClick={(e) => handleNavClick(e, '#tasksSection')}
      >
        <i className="fas fa-tasks"></i>
        <span>Görevler</span>
      </a>
      <a 
        href="#habitsSection" 
        className={`mobile-nav-item ${activeSection === 'habitsSection' ? 'active' : ''}`}
        onClick={(e) => handleNavClick(e, '#habitsSection')}
      >
        <i className="fas fa-star"></i>
        <span>Alışkanlıklar</span>
      </a>
      <a 
        href="#statsSection" 
        className={`mobile-nav-item ${activeSection === 'statsSection' ? 'active' : ''}`}
        onClick={(e) => handleNavClick(e, '#statsSection')}
      >
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
