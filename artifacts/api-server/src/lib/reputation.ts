/** Bayesian shrinkage. This is a reputation INDEX (0–100), not success probability. */
export function providerReputation(ratings: number[], prior = 0.7, weight = 5): number {
  const safe = ratings.filter(n => Number.isFinite(n) && n >= 1 && n <= 5);
  const evidence = safe.reduce((a,b)=>a+b/5,0);
  return Math.round(100*(evidence+weight*prior)/(safe.length+weight));
}
