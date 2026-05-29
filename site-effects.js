document.addEventListener('DOMContentLoaded', () => {
  const cards = Array.from(document.querySelectorAll('.project-card, .info-card, .page-hero, .split-section'));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    cards.forEach((el) => {
      el.classList.add('reveal-on-scroll');
      observer.observe(el);
    });
  }

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let tx = x;
  let ty = y;

  const move = (event) => {
    tx = event.clientX;
    ty = event.clientY;
    glow.classList.add('is-active');
  };

  window.addEventListener('mousemove', move, { passive: true });
  window.addEventListener('mouseleave', () => glow.classList.remove('is-active'));

  const animate = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    glow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    requestAnimationFrame(animate);
  };

  animate();
});
