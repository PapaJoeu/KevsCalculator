const IMPERIAL_REGION_CODES = new Set(['US', 'LR', 'MM']);

function extractRegion(locale) {
  if (typeof locale !== 'string' || locale.length === 0) return null;
  const parts = locale.split(/[-_]/);
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const part = parts[i];
    if (typeof part !== 'string') continue;
    if (/^[A-Za-z]{2}$/.test(part)) {
      return part.toUpperCase();
    }
  }
  return null;
}

function collectCandidateLocales() {
  const locales = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) {
      navigator.languages.forEach((loc) => {
        if (typeof loc === 'string' && loc) {
          locales.push(loc);
        }
      });
    }
    if (typeof navigator.language === 'string' && navigator.language) {
      locales.push(navigator.language);
    }
  }
  try {
    const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions()?.locale;
    if (typeof intlLocale === 'string' && intlLocale) {
      locales.push(intlLocale);
    }
  } catch (error) {
    // Ignore Intl errors and fall back to the provided default.
  }
  return locales;
}

function normalizeUnits(units) {
  return units === 'mm' ? 'mm' : 'in';
}

export function detectPreferredUnits(fallbackUnits = 'in') {
  const fallback = normalizeUnits(fallbackUnits);
  const locales = collectCandidateLocales();
  for (const locale of locales) {
    const region = extractRegion(locale);
    if (!region) continue;
    if (IMPERIAL_REGION_CODES.has(region)) {
      return 'in';
    }
    return 'mm';
  }
  return fallback;
}
