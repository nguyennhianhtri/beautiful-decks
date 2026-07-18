module.exports = {
  format: 'ultrawide',
  title: 'Beautiful Decks — Ultrawide 48:9 example',
  foot: 'Beautiful Decks · Ultrawide example',
  motion: true,
  slides: [
    {
      type: 'wcurtain',
      eyebrow: 'Ultrawide · 3840×720',
      title: 'Three screens. One continuous story.',
      subtitle: 'Use this 48:9 mode only for panoramic theatres or three synchronized 16:9 panels.',
    },
    {
      type: 'wflap',
      eyebrow: 'The signal',
      word: 'ONE STORY',
      caption: 'The canvas is wider; the message should become simpler, not denser.',
    },
    {
      type: 'wspotlight',
      kicker: 'Proof across the panorama',
      title: 'Distribute evidence without fragmenting the argument',
      items: [
        { n: '01', t: 'Context', b: 'What the room needs to know first', icon: 'globe' },
        { n: '02', t: 'Tension', b: 'The friction worth resolving', icon: 'shield' },
        { n: '03', t: 'Proof', b: 'Evidence the audience can inspect', icon: 'trending' },
        { n: '04', t: 'Decision', b: 'The action and owner', icon: 'rocket' },
      ],
    },
    {
      type: 'whorizon',
      eyebrow: 'The principle',
      title: 'Panoramic does not mean crowded.',
      attribution: 'Use the width for sequence, contrast, and breathing room.',
    },
    {
      type: 'wunfold',
      kicker: 'The arc',
      title: 'Three acts swing open',
      acts: [
        { n: 'Act I', t: 'Where we are', b: 'Make the current state concrete.', foot: 'Context' },
        { n: 'Act II', t: 'What changes', b: 'Show the mechanism and proof.', foot: 'Tension + evidence' },
        { n: 'Act III', t: 'What we do next', b: 'End with a decision, owner, and clock.', dark: true, foot: 'Commitment' },
      ],
    },
  ],
};
