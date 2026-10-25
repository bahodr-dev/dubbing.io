import { useEffect, type RefObject } from 'react';

export function useLandingReveal(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || reducedMotion.matches || typeof IntersectionObserver === 'undefined') return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealState = 'visible';
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -32px 0px', threshold: .08 });

    for (const element of elements) {
      // Keep content already on screen visible, including restored scroll positions.
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.dataset.revealState = 'pending';
      observer.observe(element);
    }

    const showAll = () => {
      observer.disconnect();
      elements.forEach((element) => { delete element.dataset.revealState; });
    };
    const handleMotionChange = () => { if (reducedMotion.matches) showAll(); };
    reducedMotion.addEventListener('change', handleMotionChange);
    return () => {
      showAll();
      reducedMotion.removeEventListener('change', handleMotionChange);
    };
  }, [rootRef]);
}
