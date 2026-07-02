/* KRIS PILCHER — transmission archive · live systems
   boot link-establish · drift starfield · targeting reticle ·
   telemetry strip · decode + glitch headlines · catalog stamps ·
   tape ruler · static jump transitions · scroll reveal
   All motion respects prefers-reduced-motion. */

document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- film grain ---------- */
  const grain = document.createElement('div');
  grain.className = 'grain-overlay';
  grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);

  /* ---------- boot sequence (once per session) ---------- */
  let booted = true;
  try { booted = sessionStorage.getItem('kp-boot') === '1'; } catch (e) {}
  if (!booted && !reducedMotion) {
    try { sessionStorage.setItem('kp-boot', '1'); } catch (e) {}
    const boot = document.createElement('div');
    boot.className = 'boot-overlay';
    boot.setAttribute('aria-hidden', 'true');
    const log = document.createElement('div');
    log.className = 'boot-log';
    boot.appendChild(log);
    document.body.appendChild(boot);

    const lines = [
      { t: 'KP//ARCHIVE — ESTABLISHING LINK', d: 0 },
      { t: 'REF <span class="warm">ECLIPTIC J2000.0</span>', d: 320 },
      { t: 'SITE <span class="ok">41.3874°N 2.1686°E</span>', d: 560 },
      { t: '<span class="hot">● SIGNAL LOCKED</span>', d: 860 }
    ];
    lines.forEach((l) => {
      setTimeout(() => {
        const row = document.createElement('div');
        row.innerHTML = l.t + ' <span class="caret"></span>';
        const prev = log.querySelector('.caret');
        if (prev) prev.remove();
        log.appendChild(row);
      }, l.d);
    });

    const dismiss = () => {
      boot.classList.add('is-done');
      setTimeout(() => boot.remove(), 500);
    };
    setTimeout(dismiss, 1350);
    boot.addEventListener('click', dismiss);
  }

  /* ---------- drift starfield ---------- */
  if (!reducedMotion && !document.getElementById('myVideo')) {
    const canvas = document.createElement('canvas');
    canvas.className = 'starfield-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    const ctx = canvas.getContext('2d');
    let w, h, stars;

    const seed = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(140, Math.floor((w * h) / 14000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        v: Math.random() * 0.06 + 0.015,
        tw: Math.random() * Math.PI * 2,
        hue: Math.random()
      }));
    };
    seed();
    window.addEventListener('resize', seed);

    let running = true;
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(draw);
    });

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() / 1000;
      for (const s of stars) {
        s.y -= s.v;
        if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
        const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue > 0.93
          ? 'rgba(255,62,181,' + a + ')'
          : s.hue > 0.82
            ? 'rgba(100,244,224,' + a + ')'
            : 'rgba(240,239,234,' + a + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ---------- transmission strip ---------- */
  const nav = document.querySelector('.page-nav');
  if (nav) {
    const strip = document.createElement('div');
    strip.className = 'tx-strip';
    strip.setAttribute('aria-hidden', 'true');
    strip.innerHTML = [
      '<span><b>KP//ARCHIVE</b></span>',
      '<span>REF <b>ECLIPTIC J2000.0</b></span>',
      '<span>SITE <b>41.3874°N 2.1686°E</b></span>',
      '<span class="tx-live">JD <b class="tx-jd">—</b></span>',
      '<span class="tx-sig"><span class="tx-dot">●</span> SIGNAL <b>LOCKED</b></span>'
    ].join('');
    nav.insertAdjacentElement('afterend', strip);

    const jdEl = strip.querySelector('.tx-jd');
    const tick = () => {
      jdEl.textContent = (Date.now() / 86400000 + 2440587.5).toFixed(5);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- catalog stamps ---------- */
  const prefixMap = {
    'xr': 'XR', 'images': 'IRL', 'video': 'VID', 'curator': 'CUR',
    'commercial': 'COM', 'blog': 'RES', 'dreams': 'DRM',
    'wishes': 'WSH', 'about': 'ABT'
  };
  const page = (location.pathname.split('/').pop() || '').replace('.html', '').toLowerCase();
  const prefix = prefixMap[page] || 'KP';
  document.querySelectorAll('.page-grid > .project-card, .page-grid > .info-card, .split-section > .project-card, .split-section > .info-card, .page-content > .project-card').forEach((card, i) => {
    const stamp = document.createElement('span');
    stamp.className = 'catalog-stamp';
    stamp.setAttribute('aria-hidden', 'true');
    stamp.textContent = prefix + '·' + String(i + 1).padStart(3, '0');
    card.appendChild(stamp);
  });

  /* ---------- decode-in + glitch headline ---------- */
  const h1 = document.querySelector('.page-hero h1');
  if (h1) {
    const finalText = h1.textContent;
    h1.classList.add('glitch-title');
    h1.setAttribute('data-text', finalText);
    h1.setAttribute('aria-label', finalText);

    if (!reducedMotion && finalText.length > 0 && finalText.length <= 60) {
      const glyphs = '█▓▒░<>/\\|=+*#@%&$?!01';
      let frame = 0;
      const total = Math.max(22, finalText.length * 2);
      const scramble = () => {
        frame++;
        const settled = Math.floor((frame / total) * finalText.length);
        let out = '';
        for (let i = 0; i < finalText.length; i++) {
          const ch = finalText[i];
          out += (i < settled || ch === ' ') ? ch : glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        h1.textContent = out;
        if (settled < finalText.length) requestAnimationFrame(scramble);
        else { h1.textContent = finalText; h1.classList.add('decoded'); }
      };
      requestAnimationFrame(scramble);
    } else {
      h1.classList.add('decoded');
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

  /* ---------- tape ruler ---------- */
  if (document.querySelector('.page-content')) {
    const ruler = document.createElement('div');
    ruler.className = 'tape-ruler';
    ruler.setAttribute('aria-hidden', 'true');
    const marker = document.createElement('div');
    marker.className = 'tape-marker';
    const readout = document.createElement('div');
    readout.className = 'tape-readout';
    ruler.appendChild(marker);
    ruler.appendChild(readout);
    document.body.appendChild(ruler);

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      const y = p * (window.innerHeight - 40) + 10;
      marker.style.top = y + 'px';
      readout.style.top = y + 'px';
      readout.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------- targeting reticle ---------- */
  if (!reducedMotion && finePointer) {
    const reticle = document.createElement('div');
    reticle.className = 'reticle';
    reticle.setAttribute('aria-hidden', 'true');
    reticle.innerHTML = '<div class="reticle-ring"></div><div class="reticle-readout"></div>';
    document.body.appendChild(reticle);
    document.body.classList.add('has-reticle');
    const readout = reticle.querySelector('.reticle-readout');

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;

    window.addEventListener('mousemove', (event) => {
      tx = event.clientX;
      ty = event.clientY;
      reticle.classList.add('is-active');
      const target = event.target;
      const interactive = target.closest && target.closest('a, button, .clickable-image, iframe');
      reticle.classList.toggle('is-hovering', !!interactive);
    }, { passive: true });

    document.addEventListener('mouseleave', () => reticle.classList.remove('is-active'));

    const animate = () => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      reticle.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      readout.textContent = 'X' + String(Math.round(x)).padStart(4, '0') + ' Y' + String(Math.round(y)).padStart(4, '0');
      requestAnimationFrame(animate);
    };
    animate();
  }

  /* ---------- static jump between pages ---------- */
  if (!reducedMotion) {
    const jump = document.createElement('div');
    jump.className = 'static-jump';
    jump.setAttribute('aria-hidden', 'true');
    document.body.appendChild(jump);

    document.addEventListener('click', (event) => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || link.target === '_blank' || href.startsWith('#') || href.startsWith('mailto:')) return;
      if (/^https?:\/\//i.test(href) && !href.includes(location.host)) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      jump.classList.add('is-firing');
      setTimeout(() => { location.href = href; }, 140);
    });

    window.addEventListener('pageshow', () => jump.classList.remove('is-firing'));
  }
});
