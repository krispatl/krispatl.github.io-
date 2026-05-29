document.addEventListener('DOMContentLoaded', () => {
  const images = Array.from(document.querySelectorAll('.page-content img'));
  if (!images.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'site-lightbox';
  overlay.innerHTML = `
    <button class="site-lightbox-close" aria-label="Close image">×</button>
    <img class="site-lightbox-image" alt="Expanded image">
  `;
  document.body.appendChild(overlay);

  const overlayImage = overlay.querySelector('.site-lightbox-image');
  const closeButton = overlay.querySelector('.site-lightbox-close');

  const close = () => {
    overlay.classList.remove('is-open');
    document.body.classList.remove('body-no-scroll');
    overlayImage.removeAttribute('src');
    overlayImage.removeAttribute('alt');
  };

  images.forEach((img) => {
    if (img.closest('.site-lightbox')) return;
    img.classList.add('clickable-image');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', (img.alt || 'Image') + ' — click to enlarge');

    const open = () => {
      overlayImage.src = img.currentSrc || img.src;
      overlayImage.alt = img.alt || 'Expanded image';
      overlay.classList.add('is-open');
      document.body.classList.add('body-no-scroll');
    };

    img.addEventListener('click', open);
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
});
