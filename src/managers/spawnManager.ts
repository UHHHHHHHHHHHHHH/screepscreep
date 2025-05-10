import { Role } from "../types/roles";
import { determineRoleDemand } from "../roles/roleDemand";
import { getBodyForRole } from "../roles/roleBodies";

function getAvailableHarvestTarget(room: Room): Id<Source> | null {
  const sources = room.find(FIND_SOURCES);

  // Count assigned harvesters
  const sourceCounts: Record<Id<Source>, number> = {};
  for (const source of sources) {
    sourceCounts[source.id] = 0;
  }

  for (const creep of Object.values(Game.creeps)) {
    if (creep.memory.role === 'harvester' && creep.memory.sourceId) {
      sourceCounts[creep.memory.sourceId] = (sourceCounts[creep.memory.sourceId] || 0) + 1;
    }
  }

  // Return the first source with < 2 harvesters
  const target = sources.find(source => sourceCounts[source.id] < 2);
  return target?.id || null;
}

export function manageSpawns(spawn: StructureSpawn): void {
  const room = spawn.room;
  const demand = determineRoleDemand(room);

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
      const energy = spawn.room.energyAvailable;
      const body = getBodyForRole(role, energy);
      const name = `${role}_${Game.time}`;
      let result: ScreepsReturnCode;

      if (role === 'harvester') {
        const targetSourceId = getAvailableHarvestTarget(spawn.room);
        if (!targetSourceId) {
          console.log("❌ No available source for harvester");
          continue; // skip this role
        }
      
        result = spawn.spawnCreep(body, name, {
          memory: { role, sourceId: targetSourceId },
        });
      
        if (result === OK) {
          console.log(`Spawning harvester: ${name} → source ${targetSourceId}`);
        }
      } else {
        result = spawn.spawnCreep(body, name, {
          memory: { role },
        });
      
        if (result === OK) {
          console.log(`Spawning ${role}: ${name}`);
        }
      }
      if (result === OK) {
        break; // spawn only one per tick
      }
    }
  }
}
