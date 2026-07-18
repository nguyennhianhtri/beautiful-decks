/* ============================================================================
   Beautiful Decks presentation engine (deck-agnostic)
   - Scales 1280×720 standard decks and 3840×720 ultrawide decks to the viewport.
   - Shows one active slide, restarts finite build-ins on every visit, and exposes
     window.deck for renderers and QA.
   - Keyboard, pointer, fullscreen, deep-link, accessible overview, count-up, and
     reduced-motion support.
   ============================================================================ */
(function () {
  const slides = [...document.querySelectorAll('.slide')];
  if (!slides.length) return;

  let idx = 0;
  const DESIGN_W = document.body.classList.contains('wide') ? 3840 : 1280;
  const DESIGN_H = 720;
  const interactiveSelector = 'a,button,input,textarea,select,summary,[role="button"],[contenteditable="true"]';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const countFrames = new WeakMap();

  function fit() {
    const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || DESIGN_W);
    const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || DESIGN_H);
    const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
    document.documentElement.style.setProperty('--fit', String(scale));
  }

  function runCount(slide) {
    slide.querySelectorAll('[data-countup]').forEach(el => {
      const previous = countFrames.get(el);
      if (previous) cancelAnimationFrame(previous);
      const to = Number(el.dataset.to || 0);
      const from = Number(el.dataset.from || 0);
      if (!Number.isFinite(to) || !Number.isFinite(from)) return;
      if (reducedMotion.matches) {
        el.textContent = String(Math.round(to));
        countFrames.delete(el);
        return;
      }
      const start = performance.now();
      const step = now => {
        const progress = Math.min(1, (now - start) / 1300);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(from + (to - from) * eased));
        if (progress < 1) countFrames.set(el, requestAnimationFrame(step));
        else countFrames.delete(el);
      };
      countFrames.set(el, requestAnimationFrame(step));
    });
  }

  function buildConverge(slide) {
    const host = slide.querySelector('#cvgHost');
    if (!host) return;
    host.replaceChildren();

    const orb = document.createElement('div');
    orb.className = 'cnode';
    const label = document.createElement('span');
    label.className = 'l';
    label.textContent = host.dataset.hub || 'AGENT';
    orb.appendChild(label);
    host.appendChild(orb);

    let chips = [];
    try {
      const parsed = JSON.parse(host.dataset.converge || '[]');
      if (Array.isArray(parsed)) chips = parsed;
    } catch (_) {}
    const ring = [[-230, -70], [230, -70], [-230, 70], [230, 70], [0, -128], [0, 128]];
    chips.forEach((chip, i) => {
      const item = Array.isArray(chip) ? chip : [String(chip), 0, 0];
      const el = document.createElement('div');
      el.className = 'cchip';
      const sx = Number(item[1] || 0) * 560;
      const sy = Number(item[2] || 0) * 210;
      const rest = ring[i] || [0, 0];
      el.style.cssText = `--sx:${sx}px;--sy:${sy}px;--ex:${rest[0]}px;--ey:${rest[1]}px;--d:${0.6 + i * 0.28}s`;
      const dot = document.createElement('span');
      dot.className = 'dot';
      el.append(dot, document.createTextNode(String(item[0] || '')));
      host.appendChild(el);
    });
  }

  let live = document.getElementById('deck-status');
  if (!live) {
    live = document.createElement('div');
    live.id = 'deck-status';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
    document.body.appendChild(live);
  }

  slides.forEach((slide, index) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `Slide ${index + 1} of ${slides.length}`);
    slide.tabIndex = -1;
  });

  function slideTitle(slide, fallback) {
    const title = slide.querySelector('.cv-title,.sec-title,.an-name,.ag-h,.title,.wtitle,.wsec-title,.wst-title,.big-figure,.punch-title,.prod-name');
    return (title && title.textContent ? title.textContent.trim() : fallback).replace(/\s+/g, ' ');
  }

  function show(n, options = {}) {
    const previous = idx;
    idx = Math.max(0, Math.min(slides.length - 1, Number(n) || 0));
    slides.forEach((slide, index) => {
      const active = index === idx;
      if (active) {
        slide.classList.remove('active');
        void slide.offsetWidth;
        slide.classList.add('active');
        const accent = slide.getAttribute('data-accent');
        if (accent) slide.style.setProperty('--accent', accent);
        slide.removeAttribute('inert');
        slide.setAttribute('aria-hidden', 'false');
        buildConverge(slide);
        runCount(slide);
      } else {
        slide.classList.remove('active');
        slide.setAttribute('inert', '');
        slide.setAttribute('aria-hidden', 'true');
      }
    });
    if (options.updateHistory !== false && history.replaceState) {
      history.replaceState(null, '', `#${idx + 1}`);
    }
    const title = slideTitle(slides[idx], `Slide ${idx + 1}`);
    live.textContent = `Slide ${idx + 1} of ${slides.length}: ${title}`;
    dispatchEvent(new CustomEvent('deckchange', {
      detail: { index: idx, previousIndex: previous, count: slides.length, slide: slides[idx] },
    }));
    return idx;
  }

  function go(delta) { return show(idx + delta); }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {}
  }

  let overviewElement = document.getElementById('ov');
  if (!overviewElement) {
    overviewElement = document.createElement('div');
    overviewElement.id = 'ov';
    document.body.appendChild(overviewElement);
  }
  overviewElement.setAttribute('role', 'dialog');
  overviewElement.setAttribute('aria-modal', 'true');
  overviewElement.setAttribute('aria-label', 'Slide overview');
  overviewElement.setAttribute('aria-hidden', 'true');

  function overview(on) {
    if (on) {
      overviewElement.replaceChildren();
      slides.forEach((slide, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ovcell';
        const title = slideTitle(slide, `Slide ${index + 1}`).slice(0, 80);
        const number = document.createElement('span');
        number.className = 'nn';
        number.textContent = String(index + 1);
        button.append(number, document.createTextNode(title));
        button.setAttribute('aria-label', `Go to slide ${index + 1}: ${title}`);
        button.addEventListener('click', () => {
          overview(false);
          show(index);
          slides[index].focus({ preventScroll: true });
        });
        overviewElement.appendChild(button);
      });
      overviewElement.classList.add('on');
      overviewElement.setAttribute('aria-hidden', 'false');
      const current = overviewElement.children[idx] || overviewElement.firstElementChild;
      if (current) current.focus({ preventScroll: true });
    } else {
      overviewElement.classList.remove('on');
      overviewElement.setAttribute('aria-hidden', 'true');
      slides[idx].focus({ preventScroll: true });
    }
  }

  addEventListener('keydown', event => {
    if (overviewElement.classList.contains('on')) {
      if (event.key === 'Escape') {
        overview(false);
        event.preventDefault();
      }
      return;
    }
    if (event.target && event.target.closest && event.target.closest(interactiveSelector)) return;
    switch (event.key) {
      case 'ArrowRight': case ' ': case 'PageDown': go(1); event.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': go(-1); event.preventDefault(); break;
      case 'Home': show(0); event.preventDefault(); break;
      case 'End': show(slides.length - 1); event.preventDefault(); break;
      case 'f': case 'F': toggleFullscreen(); event.preventDefault(); break;
      case 'Escape': overview(true); event.preventDefault(); break;
      default:
        if (event.key >= '1' && event.key <= '9') {
          const slideIndex = Number(event.key) - 1;
          if (slideIndex < slides.length) show(slideIndex);
        }
    }
  });

  addEventListener('click', event => {
    if (event.defaultPrevented || overviewElement.classList.contains('on')) return;
    if (event.target && event.target.closest && event.target.closest(interactiveSelector)) return;
    if (event.clientX < innerWidth * 0.22) go(-1);
    else if (event.clientX > innerWidth * 0.5) go(1);
  });

  addEventListener('resize', fit);
  addEventListener('fullscreenchange', fit);
  addEventListener('hashchange', () => {
    const requested = Number.parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(requested) && requested >= 1 && requested <= slides.length && requested - 1 !== idx) {
      show(requested - 1, { updateHistory: false });
    }
  });

  const querySlide = Number.parseInt(new URLSearchParams(location.search).get('slide'), 10);
  const hashSlide = Number.parseInt(location.hash.slice(1), 10);
  const start = Number.isFinite(querySlide) && querySlide > 0
    ? querySlide - 1
    : (Number.isFinite(hashSlide) && hashSlide > 0 ? hashSlide - 1 : 0);
  fit();
  show(start);

  window.deck = {
    show,
    go,
    next: () => go(1),
    prev: () => go(-1),
    overview,
    fullscreen: toggleFullscreen,
    fit,
    get index() { return idx; },
    count: slides.length,
  };
})();
