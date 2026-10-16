/* KRIS PILCHER — transmission archive effects
   Injected instrumentation: film grain,
   decode-in headlines, scroll reveal, cursor field.
   All motion respects prefers-reduced-motion. */

document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- film grain ---------- */
  const grain = document.createElement('div');
  grain.className = 'grain-overlay';
  grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);

  /* ---------- decode-in headline ---------- */
  const h1 = document.querySelector('.page-hero h1');
  if (h1 && !reducedMotion) {
    const finalText = h1.textContent;
    if (finalText.length > 0 && finalText.length <= 60) {
      const glyphs = '█▓▒░<>/\\|=+*#@%&$?!01';
      let frame = 0;
      const total = Math.max(22, finalText.length * 2);
      h1.setAttribute('aria-label', finalText);
      const scramble = () => {
        frame++;
        const settled = Math.floor((frame / total) * finalText.length);
        let out = '';
        for (let i = 0; i < finalText.length; i++) {
          const ch = finalText[i];
          if (i < settled || ch === ' ') out += ch;
          else out += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        h1.textContent = out;
        if (settled < finalText.length) requestAnimationFrame(scramble);
        else h1.textContent = finalText;
      };
      requestAnimationFrame(scramble);
    }
  }

  /* ---------- scroll reveal ---------- */
  const cards = Array.from(document.querySelectorAll('.project-card, .info-card, .page-hero, .split-section'));
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    cards.forEach((el) => {
      el.classList.add('reveal-on-scroll');
      observer.observe(el);
    });
  }

  /* ---------- cursor field (desktop only) ---------- */
  if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;

    window.addEventListener('mousemove', (event) => {
      tx = event.clientX;
      ty = event.clientY;
      glow.classList.add('is-active');
    }, { passive: true });

    window.addEventListener('mouseleave', () => glow.classList.remove('is-active'));

    const animate = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      glow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      requestAnimationFrame(animate);
    };
    animate();
  }
});
