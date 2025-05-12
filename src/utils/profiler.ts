export function profile<T>(label: string, fn: () => T): T {
  const start = Game.cpu.getUsed();
  const result = fn();
  const used = Game.cpu.getUsed() - start;
  console.log(`📊 ${label}: ${used.toFixed(2)} CPU`);
  return result;
}