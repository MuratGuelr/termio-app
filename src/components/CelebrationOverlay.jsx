import { useEffect, useState } from 'react';
import './CelebrationOverlay.css';

export default function CelebrationOverlay({ show }) {
  useEffect(() => {
    if (show) {
      createConfetti();
    }
  }, [show]);

  const createConfetti = () => {
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
    const celebrationEl = document.getElementById('celebrationOverlay');
    
    if (!celebrationEl) return;

    // Clear existing confetti
    celebrationEl.innerHTML = '';

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.setProperty('--x', Math.random() * 100 + 'vw');
      confetti.style.setProperty('--y', '-10px');
      confetti.style.setProperty('--x-end', (Math.random() - 0.5) * 200 + 'vw');
      confetti.style.setProperty('--y-end', '110vh');
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.animationDelay = Math.random() * 3 + 's';
      celebrationEl.appendChild(confetti);
    }
  };

  if (!show) return null;

  return <div className="celebration" id="celebrationOverlay"></div>;
}
