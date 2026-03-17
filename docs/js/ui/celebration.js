/**
 * Celebration animations triggered by unit system changes.
 *
 * Extracted from inputs.js to keep input handling focused on its core
 * responsibility. This module owns the eagle fly-by, confetti burst, and
 * the "freedom mode off" metric alert.
 */

const EAGLE_IMAGE_SRC = 'media/eagle.svg';
const EAGLE_AUDIO_SRC = 'media/eagle.wav';
const EAGLE_CLASS = 'freedom-eagle';
const ALERT_CLASS = 'freedom-alert';
const ALERT_HEADLINE_CLASS = 'freedom-alert__headline';
const ALERT_DETAIL_CLASS = 'freedom-alert__detail';
const METRIC_ALERT_DURATION_MS = 5000;
const CELEBRATION_STYLESHEET_URL = './css/celebration.css';
const CELEBRATION_STYLESHEET_ATTR = 'data-optional-celebration';
const CONFETTI_CLASS = 'freedom-confetti';
const CONFETTI_PIECE_CLASS = 'freedom-confetti__piece';
const CONFETTI_COLORS = ['#B22234', '#FFFFFF', '#3C3B6E'];

let celebrationStylesheetPromise = null;
let eagleElement = null;
let eagleAudio = null;
let alertElement = null;
let alertDismissTimeout = null;
let confettiContainer = null;
let confettiCleanupTimeout = null;

function ensureCelebrationStyles() {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = document.querySelector(`link[${CELEBRATION_STYLESHEET_ATTR}]`);
  if (existing && existing.sheet) {
    return Promise.resolve(existing);
  }

  if (celebrationStylesheetPromise) {
    return celebrationStylesheetPromise;
  }

  celebrationStylesheetPromise = new Promise((resolve, reject) => {
    const link = existing || document.createElement('link');

    function handleLoad() {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
      resolve(link);
    }

    function handleError(event) {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
      celebrationStylesheetPromise = null;
      reject(event);
    }

    if (!existing) {
      link.rel = 'stylesheet';
      link.href = CELEBRATION_STYLESHEET_URL;
      link.setAttribute(CELEBRATION_STYLESHEET_ATTR, 'true');
      document.head.appendChild(link);
    } else if (existing.sheet) {
      resolve(existing);
      return;
    }

    link.addEventListener('load', handleLoad, { once: true });
    link.addEventListener('error', handleError, { once: true });
  }).catch((error) => {
    console.warn('Failed to load celebration styles:', error);
    throw error;
  });

  return celebrationStylesheetPromise;
}

function destroyConfetti() {
  if (confettiCleanupTimeout) {
    clearTimeout(confettiCleanupTimeout);
    confettiCleanupTimeout = null;
  }
  if (confettiContainer) {
    confettiContainer.remove();
    confettiContainer = null;
  }
}

function launchConfetti() {
  if (typeof document === 'undefined') return;
  destroyConfetti();
  const container = document.createElement('div');
  container.className = CONFETTI_CLASS;
  const totalPieces = 60;
  let maxLifespan = 0;
  for (let i = 0; i < totalPieces; i += 1) {
    const piece = document.createElement('span');
    piece.className = CONFETTI_PIECE_CLASS;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const startX = `${Math.random() * 100}vw`;
    const endX = `${Math.random() * 100}vw`;
    const rotation = `${Math.random() * 960 - 480}deg`;
    const duration = 3 + Math.random() * 2.5;
    const delay = Math.random() * 0.9;
    const scale = (0.6 + Math.random() * 0.7).toFixed(2);
    piece.style.setProperty('--confetti-color', color);
    piece.style.setProperty('--confetti-x-start', startX);
    piece.style.setProperty('--confetti-x-end', endX);
    piece.style.setProperty('--confetti-rotation', rotation);
    piece.style.setProperty('--confetti-duration', `${duration}s`);
    piece.style.setProperty('--confetti-delay', `${delay}s`);
    piece.style.setProperty('--confetti-scale', scale);
    container.appendChild(piece);
    maxLifespan = Math.max(maxLifespan, duration + delay);
  }
  document.body.appendChild(container);
  confettiContainer = container;
  confettiCleanupTimeout = window.setTimeout(() => {
    destroyConfetti();
  }, (maxLifespan + 0.5) * 1000);
}

export function destroyEagle() {
  if (eagleElement) {
    eagleElement.removeEventListener('animationend', destroyEagle);
    eagleElement.remove();
    eagleElement = null;
  }
  if (eagleAudio) {
    eagleAudio.pause();
    try {
      eagleAudio.currentTime = 0;
    } catch (err) {
      // Some browsers may not allow resetting currentTime immediately after pause.
    }
  }
  destroyConfetti();
}

function triggerFreedomEagle() {
  destroyEagle();
  if (!eagleAudio) {
    eagleAudio = new Audio(EAGLE_AUDIO_SRC);
    eagleAudio.preload = 'auto';
  }
  const playPromise = eagleAudio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }

  ensureCelebrationStyles()
    .then(() => {
      const img = document.createElement('img');
      img.src = EAGLE_IMAGE_SRC;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.className = EAGLE_CLASS;
      img.addEventListener('animationend', destroyEagle, { once: true });
      document.body.appendChild(img);
      eagleElement = img;
      launchConfetti();
    })
    .catch(() => {
      // If the stylesheet fails to load, we silently skip the visual celebration.
    });
}

export function dismissAlert() {
  if (alertDismissTimeout) {
    clearTimeout(alertDismissTimeout);
    alertDismissTimeout = null;
  }
  if (alertElement) {
    alertElement.remove();
    alertElement = null;
  }
}

function showFreedomAlert() {
  dismissAlert();
  destroyEagle();
  ensureCelebrationStyles()
    .then(() => {
      const alert = document.createElement('div');
      alert.className = ALERT_CLASS;
      alert.setAttribute('role', 'status');
      alert.setAttribute('aria-live', 'assertive');

      const headline = document.createElement('span');
      headline.className = ALERT_HEADLINE_CLASS;
      headline.textContent = 'Freedom mode off';

      const detail = document.createElement('span');
      detail.className = ALERT_DETAIL_CLASS;
      detail.textContent = 'Metric defaults loaded';

      alert.append(headline, detail);
      document.body.appendChild(alert);
      alertElement = alert;
      alertDismissTimeout = setTimeout(dismissAlert, METRIC_ALERT_DURATION_MS);
    })
    .catch(() => {
      // No alert if the stylesheet cannot be loaded.
    });
}

export function handleUnitCelebration(units) {
  if (units === 'in') {
    dismissAlert();
    triggerFreedomEagle();
  } else {
    destroyEagle();
  }

  if (units === 'mm') {
    showFreedomAlert();
  } else if (units !== 'in') {
    dismissAlert();
  }
}
