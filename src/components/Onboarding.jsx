import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Onboarding.css';

// Step configuration with target selectors and behaviors
const stepDefs = [
  {
    id: 'welcome',
    title: 'Hoş geldin! ',
    text: 'Kısa bir tur ile temel butonları birlikte keşfedelim.',
    mode: 'modal', // free next
  },
  {
    id: 'theme',
    title: 'Tema Değiştir',
    text: 'Lütfen ay simgesi olan butona tıkla. Tema anında değişir.',
    selector: '.header .theme-toggle:first-of-type',
    selectorMobile: '.mobile-nav .mobile-nav-item:last-child, #mobileThemeIcon, #mobileThemeText',
    mode: 'click', // advance on target click
  },
  {
    id: 'edit_on',
    title: 'Düzenleme Modu',
    text: 'Düzenleme butonuna tıkla. Listeleri düzenleyebilmeni sağlar.',
    selector: '.header .edit-mode-btn',
    mode: 'click',
  },
  {
    id: 'edit_off',
    title: 'Düzenlemeyi Kapat',
    text: 'Aynı butona tekrar tıklayarak düzenlemeyi kapat.',
    selector: '.header .edit-mode-btn',
    mode: 'click',
  },
  {
    id: 'focus',
    title: 'Odak Modu',
    text: 'Bir görevdeki kum saati simgesine tıkla. Odak modunu başlatır.',
    selector: '#tasksSection .focus-btn', // highlight the first available focus button
    mode: 'click',
  },
  {
    id: 'focus_timer',
    title: 'Zamanlayıcı',
    text: 'Burada süreyi görürsün. Odak modu boyunca sayaç iner.',
    selector: '#focusModeOverlay #focusTimerDisplay',
    mode: 'modal',
  },
  {
    id: 'focus_exit',
    title: 'Odaktan Çıkış',
    text: 'Bittiğinde bu butona tıklayarak odak modunu kapatabilirsin.',
    selector: '#focusModeOverlay button',
    mode: 'click',
  },
  {
    id: 'done',
    title: 'Hazırsın! ✅',
    text: 'İyi kullanımlar! Bu turu ayarlardan tekrar açabilirsin.',
    mode: 'modal',
  },
];

export default function Onboarding({ onComplete }) {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const targetElRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const step = stepDefs[stepIndex];

  // Persist current step (best-effort)
  useEffect(() => {
    const persist = async () => {
      try {
        if (!user) return;
        const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
        await setDoc(ref, { step: stepIndex, completed: false }, { merge: true });
      } catch { /* ignore */ }
    };
    persist();
  }, [stepIndex, user]);

  // Resolve selector and add spotlight/rect for any step with selector
  useEffect(() => {
    cleanupListeners();
    targetElRef.current = null;
    setTargetRect(null);

    const sel = (isMobile && step.selectorMobile) ? step.selectorMobile : step.selector;
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    targetElRef.current = el;
    el.classList.add('onboarding-spotlight');
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    (window.__onboardingCleanup ||= []).push(() => {
      el.classList.remove('onboarding-spotlight');
    });
  }, [step, isMobile]);

  // For click steps, delegate click handling on document and block unrelated clicks
  useEffect(() => {
    const activeSelector = (isMobile && step.selectorMobile) ? step.selectorMobile : step.selector;
    if (step.mode !== 'click' || !activeSelector) return;
    const handler = (ev) => {
      const matched = ev.target.closest(activeSelector);
      if (matched) {
        // allow the real click to go through and advance tutorial
        setTimeout(() => advance(), 0);
        return; // do not block
      }
      // block unrelated clicks during click steps
      ev.stopPropagation();
      ev.preventDefault();
    };
    document.addEventListener('click', handler, true);
    (window.__onboardingCleanup ||= []).push(() => {
      document.removeEventListener('click', handler, true);
    });
  }, [step.mode, step.selector, step.selectorMobile, isMobile]);

  // Recalculate position on scroll/resize so the spotlight stays aligned.
  // Also re-resolve target if it was replaced due to re-render (e.g., edit toggle).
  useEffect(() => {
    const updateRect = () => {
      const current = targetElRef.current;
      if (!(step.selector || step.selectorMobile)) return;
      if (!current || !document.contains(current)) {
        const activeSelector = (isMobile && step.selectorMobile) ? step.selectorMobile : step.selector;
        const nextEl = activeSelector ? document.querySelector(activeSelector) : null;
        if (nextEl) {
          targetElRef.current = nextEl;
          const r = nextEl.getBoundingClientRect();
          setTargetRect(r);
        }
      } else {
        const r = current.getBoundingClientRect();
        setTargetRect(r);
      }
    };
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    const id = setInterval(updateRect, 200);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(id);
    };
  }, [step.selector, step.selectorMobile, isMobile]);

  useEffect(() => () => cleanupListeners(), []);

  const cleanupListeners = () => {
    if (window.__onboardingCleanup) {
      window.__onboardingCleanup.forEach((fn) => {
        try { fn(); } catch {}
      });
      window.__onboardingCleanup = [];
    }
  };

  const advance = async () => {
    if (stepIndex < stepDefs.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      try {
        if (user) {
          const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
          await setDoc(ref, { completed: true, step: stepDefs.length - 1 }, { merge: true });
        }
      } finally {
        onComplete?.();
      }
    }
  };

  const back = () => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  };

  // Tooltip positioning near target, avoiding overlap
  const tooltipStyle = useMemo(() => {
    const W = 300; // approx card width
    const H = 130; // approx card height
    const M = 12;  // margin
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!targetRect) {
      const left = Math.max(16, (vw - W) / 2);
      const top = Math.max(16, vh * 0.25);
      return { top: `${top}px`, left: `${left}px` };
    }

    const r = targetRect;
    // Try RIGHT
    let left = r.right + M;
    let top = Math.max(16, Math.min(vh - H - 16, r.top + (r.height - H) / 2));
    if (left + W <= vw - 16) return { top: `${top}px`, left: `${left}px` };

    // Try LEFT
    left = r.left - W - M;
    top = Math.max(16, Math.min(vh - H - 16, r.top + (r.height - H) / 2));
    if (left >= 16) return { top: `${top}px`, left: `${left}px` };

    // Try BOTTOM
    left = Math.max(16, Math.min(vw - W - 16, r.left + (r.width - W) / 2));
    top = r.bottom + M;
    if (top + H <= vh - 16) return { top: `${top}px`, left: `${left}px` };

    // Try TOP
    left = Math.max(16, Math.min(vw - W - 16, r.left + (r.width - W) / 2));
    top = r.top - H - M;
    if (top >= 16) return { top: `${top}px`, left: `${left}px` };

    // Fallback to centered bottom area
    left = Math.max(16, (vw - W) / 2);
    top = Math.max(16, vh - H - 24);
    return { top: `${top}px`, left: `${left}px` };
  }, [targetRect]);

  // Overlay spotlight style (cutout hole)
  const overlayStyle = useMemo(() => {
    if (!targetRect) return {};
    const padding = isMobile ? 16 : 10;
    const cx = targetRect.left + targetRect.width / 2;
    const cy = targetRect.top + targetRect.height / 2;
    const r = Math.ceil(Math.max(targetRect.width, targetRect.height) / 2) + padding;
    const bg = `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,0.55) ${r + 1}px)`;
    return { background: bg };
  }, [targetRect, isMobile]);

  const renderHint = (
    <div className="onboarding-hint" style={tooltipStyle}>
      <h3 className="hint-title">{step.title}</h3>
      <p className="hint-text">{step.text}</p>
      <div className="hint-actions">
        <button className="btn btn-secondary" onClick={back}>Geri</button>
        <button className="btn btn-primary" onClick={advance}>{stepIndex === stepDefs.length - 1 ? 'Bitir' : 'İleri'}</button>
      </div>
    </div>
  );

  const renderMobileSheet = (
    <div className="onboarding-sheet">
      <div className="sheet-header">
        <span className="onboarding-step">{stepIndex + 1}/{stepDefs.length}</span>
        <button className="btn btn-secondary" onClick={onComplete}>Atla</button>
      </div>
      <div className="sheet-body">
        <h3 className="hint-title">{step.title}</h3>
        <p className="hint-text">{step.text}</p>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary" onClick={back} disabled={stepIndex === 0}>Geri</button>
        <button className="btn btn-primary" onClick={advance}>{stepIndex === stepDefs.length - 1 ? 'Bitir' : 'İleri'}</button>
      </div>
    </div>
  );

  return (
    <div className="onboarding-overlay" aria-live="polite" style={overlayStyle}>
      {/* If a selector exists, prefer hint; on mobile use bottom sheet */}
      {(step.selector || step.selectorMobile) ? (
        isMobile ? renderMobileSheet : renderHint
      ) : (
        step.mode === 'modal' && (
          <div className="onboarding-card" role="dialog" aria-modal="true">
            <div className="onboarding-header">
              <span className="onboarding-step">{stepIndex + 1}/{stepDefs.length}</span>
              <button className="btn btn-secondary" onClick={onComplete}>Atla</button>
            </div>
            <h2 className="onboarding-title">{step.title}</h2>
            <p className="onboarding-text">{step.text}</p>
            <div className="onboarding-actions">
              <button className="btn btn-secondary" onClick={back} disabled={stepIndex === 0}>Geri</button>
              <button className="btn btn-primary" onClick={advance}>{stepIndex === stepDefs.length - 1 ? 'Bitir' : 'İleri'}</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
