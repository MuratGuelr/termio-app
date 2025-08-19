import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './OnboardingMobile.css';

// Phone-only tutorial with simplified UI (bottom sheet) and mobile selectors
const mobileSteps = [
  {
    id: 'welcome',
    title: 'Başlayalım',
    text: 'Telefon için kısa bir tur. Sonrasında dilediğin zaman Ayarlar’dan tekrar açabilirsin.',
    mode: 'modal',
  },
  {
    id: 'theme',
    title: 'Tema',
    text: 'Alttaki menüden tema simgesine dokun. Tema anında değişir.',
    selector: '.mobile-nav .mobile-nav-item:last-child, #mobileThemeIcon, #mobileThemeText',
    mode: 'click',
    preferredPlacement: 'top',
  },
  {
    id: 'edit_on',
    title: 'Düzenleme Modu',
    text: 'Alt köşedeki Düzenle düğmesine dokunarak listeyi düzenleyebilirsin.',
    selector: '.mobile-edit-btn',
    mode: 'click',
    preferredPlacement: 'top',
  },
  {
    id: 'edit_off',
    title: 'Düzenlemeyi Kapat',
    text: 'Zamanlayıcıya erişmek için Düzenle düğmesine tekrar dokun ve düzenlemeyi kapat.',
    selector: '.mobile-edit-btn',
    mode: 'click',
    preferredPlacement: 'top',
  },
  {
    id: 'focus',
    title: 'Odak Modu',
    text: 'Bir görevdeki kum saati simgesine dokun. Odak modunu başlatır.',
    selector: '#tasksSection .focus-btn',
    mode: 'click',
  },
  {
    id: 'timer',
    title: 'Zamanlayıcı',
    text: 'Odak sayacını burada takip edebilirsin.',
    selector: '#focusModeOverlay #focusTimerDisplay',
    mode: 'hint',
    preferredPlacement: 'bottom',
  },
  {
    id: 'timer_close',
    title: 'Odak Modunu Kapat',
    text: 'Zamanlayıcıyı kapatmak için buraya dokun.',
    selector: '#focusModeOverlay button',
    mode: 'click',
  },
  {
    id: 'done',
    title: 'Bitti',
    text: 'Harika! Termio’yu keşfetmeye hazırsın.',
    mode: 'modal',
  },
];

export default function OnboardingMobile({ onComplete }) {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [sheetBottomOffset, setSheetBottomOffset] = useState(0);
  const [sheetPlacement, setSheetPlacement] = useState('bottom'); // 'bottom' | 'top'
  const [sheetTopOffset, setSheetTopOffset] = useState(0);
  const targetElRef = useRef(null);
  const sheetRef = useRef(null);

  const step = mobileSteps[stepIndex];

  // Persist progress (best-effort)
  useEffect(() => {
    const persist = async () => {
      try {
        if (!user) return;
        const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
        await setDoc(ref, { step: stepIndex, completed: false, device: 'mobile' }, { merge: true });
      } catch (e) {
        // noop
      }
    };
    persist();
  }, [stepIndex, user]);

  // Resolve selector and compute rect (with observer + retry)
  useEffect(() => {
    cleanup();
    targetElRef.current = null;
    setTargetRect(null);

    if (!step.selector) return;

    let resolved = false;
    const tryResolve = () => {
      if (resolved) return;
      const el = document.querySelector(step.selector);
      if (el) {
        resolved = true;
        targetElRef.current = el;
        setTargetRect(el.getBoundingClientRect());
        // add spotlight highlight
        el.classList.add('onboarding-spotlight');
        // Avoid scrolling if element is fixed (e.g., bottom nav)
        const pos = window.getComputedStyle(el).position;
        if (pos !== 'fixed') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    // Initial attempt + a few raf retries
    let raf1 = requestAnimationFrame(tryResolve);
    let raf2 = requestAnimationFrame(tryResolve);
    let raf3 = requestAnimationFrame(tryResolve);

    // Observe DOM mutations briefly to catch late renders
    const observer = new MutationObserver(() => tryResolve());
    observer.observe(document.body, { childList: true, subtree: true });

    (window.__onboardingMobileCleanup ||= []).push(() => {
      observer.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      if (targetElRef.current) {
        try { targetElRef.current.classList.remove('onboarding-spotlight'); } catch {}
      }
    });
  }, [step]);

  // Delegate click handling for click steps (non-blocking on mobile)
  useEffect(() => {
    if (step.mode !== 'click' || !step.selector) return;
    const handler = (ev) => {
      const sel = step.selector;
      const matched = ev.target.closest(sel);
      if (matched) {
        setTimeout(() => next(), 0);
        return;
      }
      // Do not block unrelated taps on mobile to avoid perceived freezing
    };
    document.addEventListener('click', handler, true);
    (window.__onboardingMobileCleanup ||= []).push(() => {
      document.removeEventListener('click', handler, true);
    });
  }, [step, targetElRef.current]);

  // Keep rect aligned on scroll/resize
  useEffect(() => {
    const update = () => {
      const el = targetElRef.current;
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const id = setInterval(update, 250);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      clearInterval(id);
    };
  }, []);

  // Avoid sheet overlapping the target (approximate)
  useEffect(() => {
    const vh = window.innerHeight;
    const margin = 12;
    if (!targetRect) { setSheetBottomOffset(0); setSheetPlacement('bottom'); return; }

    // Measure actual sheet height if available, fallback to estimate
    const H = (sheetRef.current && sheetRef.current.getBoundingClientRect().height) || 220;

    // If target is inside the bottom mobile nav, prefer placing sheet on top
    const nav = document.querySelector('.mobile-nav');
    const isInNav = nav && targetElRef.current && nav.contains(targetElRef.current);
    const safeTop = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || '0') || 0;
    const safeBottom = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '0') || 0;

    // Check overlap if sheet is at bottom
    const bottomStart = vh - H - safeBottom;
    const overlapsBottom = targetRect.top < vh && targetRect.bottom > bottomStart - margin;

    // Check overlap if sheet is at top
    const topEnd = H + safeTop;
    const overlapsTop = targetRect.top < topEnd + margin;

    if (isInNav || overlapsBottom) {
      // Try top placement
      setSheetPlacement('top');
      // Keep a small offset below status bar
      setSheetTopOffset(8);
      setSheetBottomOffset(0);
    } else if (overlapsTop) {
      // If top would overlap, keep bottom but lift it further above target
      setSheetPlacement('bottom');
      const needed = Math.max(0, targetRect.bottom - (vh - H) + margin);
      setSheetBottomOffset(needed);
      setSheetTopOffset(0);
    } else {
      // Default bottom placement without extra lift
      setSheetPlacement('bottom');
      setSheetBottomOffset(0);
      setSheetTopOffset(0);
    }
  }, [targetRect]);

  useEffect(() => () => cleanup(), []);

  const cleanup = () => {
    if (window.__onboardingMobileCleanup) {
      window.__onboardingMobileCleanup.forEach((fn) => { try { fn(); } catch {} });
      window.__onboardingMobileCleanup = [];
    }
  };

  const next = () => {
    if (stepIndex < mobileSteps.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  };
  const back = () => setStepIndex(Math.max(0, stepIndex - 1));
  const finish = async () => {
    try {
      if (user) {
        const ref = doc(db, 'users', user.uid, 'settings', 'tutorial');
        await setDoc(ref, { completed: true }, { merge: true });
      }
    } finally {
      onComplete?.();
    }
  };

  const overlayStyle = useMemo(() => {
    if (!targetRect) return {};
    const padding = 16;
    const cx = targetRect.left + targetRect.width / 2;
    const cy = targetRect.top + targetRect.height / 2;
    const r = Math.ceil(Math.max(targetRect.width, targetRect.height) / 2) + padding;
    const bg = `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,0.55) ${r + 1}px)`;
    return { background: bg };
  }, [targetRect]);

  return (
    <div className="onboarding-mobile-overlay" style={overlayStyle} aria-live="polite">
      {/* Unified modal card for all steps (consistent placement) */}
      <div className="onboarding-mobile-card" key={step.id}>
        <div className="onboarding-header">
          <span className="onboarding-step">{stepIndex + 1}/{mobileSteps.length}</span>
          <button className="btn btn-secondary" onClick={finish}>Atla</button>
        </div>
        <h3 className="hint-title">{step.title}</h3>
        <p className="hint-text">{step.text}</p>
        <div className="onboarding-actions">
          <button className="btn btn-secondary" onClick={back} disabled={stepIndex === 0}>Geri</button>
          <button className="btn btn-primary" onClick={next}>Devam</button>
        </div>
      </div>
    </div>
  );
}
