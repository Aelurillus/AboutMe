import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export function createMotion({ reduced }) {
  const media = gsap.matchMedia();
  let entered = false;
  let context;
  const scrollTo = top => {
    gsap.killTweensOf(window);
    if (reduced.matches) window.scrollTo({ top, behavior: 'instant' });
    else gsap.to(window, { scrollTo: { y: top, autoKill: true }, duration: Math.min(1.35, 0.8 + Math.abs(top - window.scrollY) / 3000), ease: 'sine.inOut', overwrite: 'auto', onUpdate: ScrollTrigger.update });
  };
  function enter() {
    entered = true;
    document.documentElement.classList.add('motion-enhanced');
    media.add('(prefers-reduced-motion: no-preference)', () => {
      context = gsap.context(() => {
        gsap.set('.entrance, .reveal', { opacity: 1, y: 0, scale: 1 });
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline.fromTo('.profile-card', { opacity: 0, scale: 0.975 }, { opacity: 1, scale: 1, duration: 1.15 }, 0.06)
          .fromTo('.avatar', { opacity: 0, scale: 0.84 }, { opacity: 1, scale: 1, duration: 1.1, clearProps: 'transform,opacity' }, 0.18)
          .fromTo('.name, .status', { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.9, clearProps: 'transform,opacity' }, 0.3)
          .fromTo('.social', { opacity: 0, y: 14, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, stagger: 0.065, duration: 0.75, clearProps: 'transform,opacity' }, 0.5)
          .fromTo('.scroll-hint, .rail', { opacity: 0 }, { opacity: 1, duration: 1, clearProps: 'opacity' }, 0.7);
        // One scroll driver per section; promote only nearby moving surfaces.
        gsap.utils.toArray('.section').forEach(section => {
          const elements = section.querySelectorAll('.reveal');
          if (!elements.length) return;
          gsap.fromTo(elements, { opacity: 0, y: 24, force3D: true }, {
            opacity: 1, y: 0, ease: 'none',
            scrollTrigger: {
              trigger: section, start: 'top 85%', end: 'top 25%', scrub: true,
              onToggle: self => { elements.forEach(element => { element.style.willChange = self.isActive ? 'transform, opacity' : ''; }); }
            }
          });
        });
        // Interior parallax complements the original paced full-section scroll.
        gsap.to('.profile-card', { y: -35, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.utils.toArray('.section h2').forEach(heading => {
          gsap.fromTo(heading, { y: 8 }, { y: -8, ease: 'none', scrollTrigger: { trigger: heading.closest('.section'), start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        const hover = gsap.matchMedia();
        hover.add('(hover: hover) and (pointer: fine)', () => {
          const cleanup = [];
          document.querySelectorAll('.play-button, .avatar-message, .player-control').forEach(element => {
            const over = () => gsap.to(element, { y: -2, scale: 1.035, duration: 0.4, ease: 'sine.out', overwrite: 'auto' });
            const out = () => gsap.to(element, { y: 0, scale: 1, duration: 0.5, ease: 'sine.out', overwrite: 'auto' });
            const down = () => gsap.to(element, { scale: 0.975, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
            element.addEventListener('pointerenter', over); element.addEventListener('pointerleave', out);
            element.addEventListener('pointerdown', down); element.addEventListener('pointerup', over);
            cleanup.push(() => { element.removeEventListener('pointerenter', over); element.removeEventListener('pointerleave', out); element.removeEventListener('pointerdown', down); element.removeEventListener('pointerup', over); });
          });
          return () => cleanup.forEach(dispose => dispose());
        });
        return () => hover.revert();
      });
      ScrollTrigger.refresh();
      return () => { context.revert(); document.querySelectorAll('.reveal').forEach(element => { element.style.willChange = ''; }); };
    });
    // Reduced motion is also handled when changed while the page is open.
    media.add('(prefers-reduced-motion: reduce)', () => {
      gsap.killTweensOf(window);
      document.querySelectorAll('.entrance, .reveal').forEach(element => element.classList.add('is-in'));
    });
  }
  const interrupt = () => gsap.killTweensOf(window);
  addEventListener('touchstart', interrupt, { passive: true });
  document.fonts.ready.then(() => { if (entered) ScrollTrigger.refresh(); });
  return { enter, scrollTo, isScrolling: () => gsap.isTweening(window) };
}
