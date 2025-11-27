export const calculatePoints = (winnerLvl: number, loserLvl: number) => {
  const diff = winnerLvl - loserLvl;
  let winnerGain = 10;
  let loserLoss = 10;

  // Logic from PDF Page 15
  if (diff === 0) {
    winnerGain = 10;
    loserLoss = 10;
  } else if (diff > 0) {
    // Winner was higher level (Expected win, lower reward)
    if (diff === 1) winnerGain = 5;
    if (diff === 2) winnerGain = 7;
    if (diff === 3) winnerGain = 10;
    if (diff >= 4) winnerGain = 15 + (diff - 4) * 10; // Approximation based on PDF curve
  } else {
    // Winner was lower level (Upset, huge reward)
    const absDiff = Math.abs(diff);
    if (absDiff === 1) winnerGain = 15;
    if (absDiff === 2) winnerGain = 20;
    if (absDiff === 3) winnerGain = 25;
    if (absDiff === 4) winnerGain = 30;
    if (absDiff >= 5) winnerGain = 40 + (absDiff - 5) * 15;
  }

  // PDF: "If player is 9 levels lower, you lose 50 points + whole level"
  // This logic returns the delta to apply to the database
  return { winnerGain, loserLoss };
};

export const generateTournamentCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
