export function profile<T>(label: string, fn: () => T): T {
    const start = Game.cpu.getUsed();
    try {
        return fn();
    } finally {
        const used = Game.cpu.getUsed() - start;
        console.log(`📊 ${label}: ${used.toFixed(2)} CPU`);
    }
}