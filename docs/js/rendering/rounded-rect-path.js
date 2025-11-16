const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

function toPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function normalizeCornerRadii(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const normalized = CORNER_KEYS.reduce((acc, key) => {
    acc[key] = toPositiveNumber(source[key]);
    return acc;
  }, {});
  return CORNER_KEYS.some((key) => normalized[key] > 0) ? normalized : null;
}

export function clampCornerRadii(radii, width, height) {
  if (!radii) return null;
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  if (safeWidth === 0 || safeHeight === 0) {
    return null;
  }
  const maxRadius = Math.min(safeWidth, safeHeight) / 2;
  if (maxRadius <= 0) return null;
  const clampValue = (value) => Math.min(Math.max(value, 0), maxRadius);
  const clamped = CORNER_KEYS.reduce((acc, key) => {
    acc[key] = clampValue(radii[key] ?? 0);
    return acc;
  }, {});
  return CORNER_KEYS.some((key) => clamped[key] > 0) ? clamped : null;
}

export function scaleCornerRadii(radii, scale) {
  if (!radii) return null;
  const factor = Number(scale) || 1;
  if (factor <= 0) return null;
  return CORNER_KEYS.reduce((acc, key) => {
    acc[key] = (radii[key] ?? 0) * factor;
    return acc;
  }, {});
}

export function buildRoundedRectPath(x, y, width, height, radii) {
  if (!radii) return '';
  const left = x;
  const top = y;
  const right = x + width;
  const bottom = y + height;
  const tl = radii.topLeft ?? 0;
  const tr = radii.topRight ?? 0;
  const br = radii.bottomRight ?? 0;
  const bl = radii.bottomLeft ?? 0;
  const commands = [];
  commands.push(`M ${left + tl} ${top}`);
  commands.push(`H ${right - tr}`);
  if (tr > 0) {
    commands.push(`Q ${right} ${top} ${right} ${top + tr}`);
  } else {
    commands.push(`L ${right} ${top}`);
  }
  commands.push(`V ${bottom - br}`);
  if (br > 0) {
    commands.push(`Q ${right} ${bottom} ${right - br} ${bottom}`);
  } else {
    commands.push(`L ${right} ${bottom}`);
  }
  commands.push(`H ${left + bl}`);
  if (bl > 0) {
    commands.push(`Q ${left} ${bottom} ${left} ${bottom - bl}`);
  } else {
    commands.push(`L ${left} ${bottom}`);
  }
  commands.push(`V ${top + tl}`);
  if (tl > 0) {
    commands.push(`Q ${left} ${top} ${left + tl} ${top}`);
  } else {
    commands.push(`L ${left} ${top}`);
  }
  commands.push('Z');
  return commands.join(' ');
}
