export function demandScore(total: number, recent: number, previous: number, ageDays: number) {
  return (Math.log1p(total) * 3 + recent * 2 + Math.max(0, recent - previous)) / Math.pow(1 + Math.max(0, ageDays) / 7, 0.7);
}