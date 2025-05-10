const ROLE_LOCK_DURATION = 100; // ticks to stay locked after switching

export function updateRoles(): void {
  if (Game.time % 10 !== 0) return; // Throttle to every 10 ticks

  for (const room of Object.values(Game.rooms)) {
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    const needsBuilders = constructionSites.length > 0;

    const upgraders = Object.values(Game.creeps).filter(c =>
      c.memory.role === 'upgrader' &&
      (!c.memory.lockUntil || Game.time >= c.memory.lockUntil)
    );

    const builders = Object.values(Game.creeps).filter(c =>
      c.memory.role === 'builder' &&
      (!c.memory.lockUntil || Game.time >= c.memory.lockUntil)
    );

    if (needsBuilders && upgraders.length > 0) {
      const creep = upgraders[0];
      console.log(`🔁 ${creep.name}: upgrader → builder`);
      creep.memory.role = 'builder';
      creep.memory.lockUntil = Game.time + ROLE_LOCK_DURATION;
    }

    if (!needsBuilders && builders.length > 0) {
      const creep = builders[0];
      console.log(`🔁 ${creep.name}: builder → upgrader`);
      creep.memory.role = 'upgrader';
      creep.memory.lockUntil = Game.time + ROLE_LOCK_DURATION;
    }
  }
}
