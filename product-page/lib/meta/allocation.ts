/** Largest-remainder allocation in whole UAH; never changes the checkout total. */
export function allocateDiscount(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((total, value) => total + value, 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > sum || weights.some(value => !Number.isInteger(value) || value < 0)) throw new Error('Invalid Meta allocation');
  if (!sum || amount === 0) return weights.map(() => 0);
  const shares = weights.map(value => Math.floor(amount * value / sum));
  const ranked = weights.map((value, index) => ({ index, remainder: amount * value % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let left = amount - shares.reduce((total, value) => total + value, 0), index = 0; left > 0; left--, index++) shares[ranked[index].index]++;
  return shares;
}
