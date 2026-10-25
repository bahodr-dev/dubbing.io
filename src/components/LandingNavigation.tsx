import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const sections = [
  { id: 'studio', label: 'Studiya' },
  { id: 'how-it-works', label: 'Qanday ishlaydi?' },
  { id: 'possibilities', label: 'Imkoniyatlar' },
  { id: 'faq', label: 'Savol-javob' },
];

interface LandingNavigationProps {
  isOpen: boolean;
  onNavigate: () => void;
}

export function LandingNavigation({ isOpen, onNavigate }: LandingNavigationProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let disposed = false;
    const targets = sections.map(({ id }) => document.getElementById(id));
    const update = () => {
      frame = 0;
      if (disposed) return;
      let current: string | null = null;
      if (window.scrollY > 16) {
        const headerHeight = navRef.current?.closest('header')?.offsetHeight ?? 88;
        const activationLine = Math.max(headerHeight + 24, Math.min(window.innerHeight * .28, 240));
        for (const target of targets) {
          if (target && target.getBoundingClientRect().top <= activationLine) current = target.id;
        }
        const pageHeight = document.documentElement.scrollHeight;
        if (pageHeight > window.innerHeight && window.scrollY + window.innerHeight >= pageHeight - 2) {
          current = 'faq';
        }
      }
      setActiveSection(current);
    };
    const scheduleUpdate = () => {
      if (!disposed && !frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleUpdate) : null;
    targets.forEach((target) => { if (target) observer?.observe(target); });
    document.fonts?.ready.then(scheduleUpdate);
    scheduleUpdate();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      observer?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    let disposed = false;
    const nav = navRef.current;
    const positionIndicator = () => {
      if (disposed || !nav || !indicatorRef.current || !activeSection) return;
      const link = nav.querySelector<HTMLAnchorElement>(`a[href="#${activeSection}"]`);
      if (!link) return;
      Object.assign(indicatorRef.current.style, {
        width: `${link.offsetWidth}px`, height: `${link.offsetHeight}px`,
        transform: `translate3d(${link.offsetLeft}px, ${link.offsetTop}px, 0)`,
      });
    };
    positionIndicator();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(positionIndicator) : null;
    if (nav) observer?.observe(nav);
    window.addEventListener('resize', positionIndicator);
    document.fonts?.ready.then(positionIndicator);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', positionIndicator);
    };
  }, [activeSection, isOpen]);

  return (
    <nav ref={navRef} className={`landing-nav${isOpen ? ' is-open' : ''}`} id="landing-navigation" aria-label="Bosh sahifa menyusi">
      <span ref={indicatorRef} className="landing-nav-indicator" aria-hidden="true" hidden={!activeSection} />
      {sections.map(({ id, label }) => (
        <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={onNavigate}>{label}</a>
      ))}
    </nav>
  );
}
