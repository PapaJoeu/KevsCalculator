const sanitizeInteger = (value) => Math.max(0, Math.floor(Number(value) || 0));
const sanitizeFloat = (value) => Math.max(0, Number(value) || 0);

export const calculatePadTotals = ({ padCount = 0, sheetsPerPad = 0, nUp = 0 } = {}) => {
  const pads = sanitizeInteger(padCount);
  const sheets = sanitizeInteger(sheetsPerPad);
  const nUpValue = sanitizeInteger(nUp);
  if (pads <= 0 || sheets <= 0 || nUpValue <= 0) {
    return null;
  }
  const totalPieces = pads * sheets;
  const totalSheets = Math.ceil(totalPieces / nUpValue);
  const overagePieces = Math.max(0, totalSheets * nUpValue - totalPieces);
  return { totalPieces, totalSheets, overagePieces };
};

export const calculateRunPlan = ({ desiredPieces = 0, nUp = 0, oversPercent = 0 } = {}) => {
  const desired = sanitizeInteger(desiredPieces);
  const nUpValue = sanitizeInteger(nUp);
  const overs = sanitizeFloat(oversPercent);
  if (desired <= 0 || nUpValue <= 0) {
    return null;
  }
  const oversPieces = Math.ceil((desired * overs) / 100);
  const totalPieces = desired + oversPieces;
  const baseSheets = Math.ceil(desired / nUpValue);
  const totalSheets = Math.ceil(totalPieces / nUpValue);
  const oversSheets = Math.max(0, totalSheets - baseSheets);
  return { totalPieces, totalSheets, oversPieces, oversSheets };
};

export const calculateSheetConversion = ({
  sheetsToRun = 0,
  nUp = 0,
  piecesPerPad = 0,
} = {}) => {
  const sheets = sanitizeInteger(sheetsToRun);
  const nUpValue = sanitizeInteger(nUp);
  const piecesPerPadValue = sanitizeInteger(piecesPerPad);
  if (sheets <= 0 || nUpValue <= 0) {
    return null;
  }
  const totalPieces = sheets * nUpValue;
  const hasPadBreakdown = piecesPerPadValue > 0;
  const completePads = hasPadBreakdown ? Math.floor(totalPieces / piecesPerPadValue) : null;
  const remainderPieces = hasPadBreakdown ? totalPieces % piecesPerPadValue : null;
  return { totalPieces, hasPadBreakdown, completePads, remainderPieces };
};
