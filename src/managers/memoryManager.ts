export function cleanCreepMemory() {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
        console.log(`🧹 Cleaned up memory for dead creep: ${name}`);
      }
    }
  }
