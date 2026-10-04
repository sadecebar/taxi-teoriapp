/** Styling for one answer option in its current reveal state. */
export function optionStyles(C, i, correctIdx, chosenIdx, revealed) {
  const isCorrect = i === correctIdx;
  const isChosen  = i === chosenIdx;

  if (revealed) {
    if (isCorrect) return {
      bg: C.greenBg, brd: C.greenBorder, col: C.greenLight,
      badgeBg: "rgba(79,168,112,0.22)", badgeCol: C.greenLight, badgeBrd: C.green,
      indicator: "✓",
    };
    if (isChosen) return {
      bg: C.redBg, brd: C.redBorder, col: C.redLight,
      badgeBg: "rgba(184,80,88,0.22)", badgeCol: C.redLight, badgeBrd: C.red,
      indicator: "✗",
    };
    return {
      bg: "transparent", brd: C.borderSoft, col: C.muted,
      badgeBg: "transparent", badgeCol: C.faint, badgeBrd: C.faint,
      indicator: null,
    };
  }

  if (isChosen) return {
    bg: C.goldBg, brd: C.gold, col: C.goldLight,
    badgeBg: "rgba(201,168,76,0.20)", badgeCol: C.goldLight, badgeBrd: C.gold,
    indicator: null,
  };

  return {
    bg: C.surface, brd: C.border, col: C.textSoft,
    badgeBg: C.surfaceAlt, badgeCol: C.muted, badgeBrd: C.border,
    indicator: null,
  };
}
