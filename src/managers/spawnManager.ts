import { Role } from "../types/roles";
import { determineRoleDemand } from "../roles/roleDemand";
import { roleBodies } from "../roles/roleBodies";

export function manageSpawns(spawn: StructureSpawn): void {
  const room = spawn.room;
  const demand = determineRoleDemand(room);

  console.log(`[demand]`, demand);

  const harvestersAlive = Object.values(Game.creeps).filter(
    c => c.memory.role === 'harvester'
  ).length;

  // 🆘 Emergency bootstrapping logic
  if (harvestersAlive === 0 && spawn.store[RESOURCE_ENERGY] >= 200) {
    const name = `emergency_harvester_${Game.time}`;
    const result = spawn.spawnCreep([WORK, CARRY, MOVE], name, {
      memory: { role: 'harvester' },
    });

    if (result === OK) {
      console.log(`🆘 Emergency harvester spawned: ${name}`);
      return;
    }
  }

  for (const role of Object.keys(demand) as Role[]) {
    const desired = demand[role];
    const current = Object.values(Game.creeps).filter(
      c => c.memory.role === role
    ).length;

    if (current < desired) {
      const name = `${role}_${Game.time}`;
      const result = spawn.spawnCreep(roleBodies[role], name, {
        memory: { role },
      });

      if (result === OK) {
        console.log(`Spawning ${role}: ${name}`);
        break; // spawn only one per tick
      }
    }
  }
}
