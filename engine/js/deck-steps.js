/* ============================================================================
   deck-steps.js — OPT-IN per-slide "step / fragment" layer for the slide system.
   Pairs with deck-engine.js (load AFTER it). Adds in-slide steps WITHOUT touching
   the engine: a slide opts in with  data-steps="N"  and the CSS reacts to the
   data-cur="0..N" attribute this script maintains.

   Behaviour:
     • ArrowRight / Space / PageDown / click-right:
         if the active slide has steps left (cur < steps) → cur++ and SWALLOW the
         event (capture phase) so the engine does NOT change slide. Otherwise the
         event passes through and the engine advances to the next slide.
     • ArrowLeft / PageUp / click-left:
         if cur > 0 → cur-- and swallow; else pass through (engine goes back).
     • Entering a slide always resets it to its FIRST step (cur=0) so the static
       state is what the PDF/QA render captures and what a fresh visit shows.

   Why capture phase: deck-engine.js binds its keydown/click on window in the
   bubble phase. Listening here in the CAPTURE phase lets us intercept first and
   stopImmediatePropagation() to veto the engine for in-slide steps only.

   No globals beyond window.deckSteps. Zero effect on slides without data-steps.
   ============================================================================ */
(function () {
  const STEP_SEL = '.slide[data-steps]';
  const INTERACTIVE_SEL = 'a,button,input,textarea,select,summary,[role="button"],[contenteditable="true"]';

  function activeStepSlide() {
    // the engine marks one slide .active; only act if it declares steps
    const s = document.querySelector('.slide.active[data-steps]');
    if (!s) return null;
    const steps = parseInt(s.getAttribute('data-steps') || '0', 10);
    if (!steps) return null;
    return s;
  }

  function cur(s) { return parseInt(s.getAttribute('data-cur') || '0', 10); }
  function setCur(s, n) {
    const steps = parseInt(s.getAttribute('data-steps') || '0', 10);
    n = Math.max(0, Math.min(steps, n));
    s.setAttribute('data-cur', n);
    s.dispatchEvent(new CustomEvent('stepchange', { detail: { step: n, steps } }));
    return n;
  }

  // Reset to step 0 on every engine show, including show(currentIndex).
  function resetOnShow(event) {
    document.querySelectorAll(STEP_SEL).forEach(s => {
      if (!s.classList.contains('active')) s.setAttribute('data-cur', '0');
    });
    const active = event && event.detail && event.detail.slide
      ? event.detail.slide
      : activeStepSlide();
    if (active && active.matches(STEP_SEL)) setCur(active, 0);
  }
  // deckchange is authoritative; the observer remains a fallback for hand-authored decks.
  addEventListener('deckchange', resetOnShow);
  const mo = new MutationObserver(() => {
    document.querySelectorAll(STEP_SEL).forEach(s => {
      if (!s.classList.contains('active')) s.setAttribute('data-cur', '0');
    });
  });
  document.querySelectorAll(STEP_SEL).forEach(s =>
    mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('DOMContentLoaded', resetOnShow);

  function tryStep(dir, ev) {
    const s = activeStepSlide();
    if (!s) return; // no opt-in slide → let engine handle it
    const c = cur(s), steps = parseInt(s.getAttribute('data-steps'), 10);
    if (dir > 0 && c < steps) { setCur(s, c + 1); swallow(ev); }
    else if (dir < 0 && c > 0) { setCur(s, c - 1); swallow(ev); }
    // at the ends: do nothing here → event passes through → engine changes slide
    // (engine's show() will reset this slide's cur via the MutationObserver)
  }

  function swallow(ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }

  // CAPTURE phase so we run before deck-engine's bubble-phase handlers
  addEventListener('keydown', e => {
    if (document.getElementById('ov') && document.getElementById('ov').classList.contains('on')) return;
    if (e.target && e.target.closest && e.target.closest(INTERACTIVE_SEL)) return;
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': tryStep(1, e); break;
      case 'ArrowLeft': case 'PageUp': tryStep(-1, e); break;
    }
  }, true);

  addEventListener('click', e => {
    if (e.target && e.target.closest && e.target.closest(INTERACTIVE_SEL)) return;
    if (document.getElementById('ov') && document.getElementById('ov').classList.contains('on')) return;
    const s = activeStepSlide(); if (!s) return;
    const dir = e.clientX < innerWidth * 0.22 ? -1 : (e.clientX > innerWidth * 0.5 ? 1 : 0);
    if (dir) tryStep(dir, e);
  }, true);

  // public hook: jump to a specific step on the active step-slide (for QA capture)
  window.deckSteps = {
    set: n => { const s = activeStepSlide(); return s ? setCur(s, n) : -1; },
    get: () => { const s = activeStepSlide(); return s ? cur(s) : -1; },
    steps: () => { const s = activeStepSlide(); return s ? parseInt(s.getAttribute('data-steps'), 10) : 0; }
  };
})();
