import { Role } from "../types/roles";

export function countCreepsByRole(room: Room): Record<Role, number> {
  // initialize all counts to zero
  const counts = {
    harvester: 0,
    upgrader: 0,
    builder:   0,
    miner:     0,
    hauler:    0,
  } as Record<Role, number>;

  for (const creep of Object.values(Game.creeps)) {
    if (creep.room.name !== room.name) continue;
    const r = creep.memory.role as Role;
    if (counts[r] !== undefined) {
      counts[r]++;
    }
  }

  return counts;
}
