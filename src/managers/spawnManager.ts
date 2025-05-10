import { Role } from "../types/roles";

type SpawnRequest = {
  role: Role;
  body: BodyPartConstant[];
};

const roleLimits: Record<Role, number> = {
  harvester: 2,
  upgrader: 1,
  builder: 1,
};

const roleBodies: Record<Role, BodyPartConstant[]> = {
  harvester: [WORK, CARRY, MOVE, MOVE],
  upgrader: [WORK, CARRY, MOVE, MOVE],
  builder: [WORK, CARRY, MOVE, MOVE],
};

export function manageSpawns(spawn: StructureSpawn) {
  const harvestersAlive = Object.values(Game.creeps).filter(
    c => c.memory.role === 'harvester'
  ).length;
  
  // Emergency bootstrapping
  if (harvestersAlive === 0 && spawn.store[RESOURCE_ENERGY] >= 200) {
    const name = `harvester_${Game.time}`;
    const result = spawn.spawnCreep([WORK, CARRY, MOVE], name, {
      memory: { role: 'harvester' }
    });
  
    if (result === OK) {
      console.log(`🆘 Emergency harvester spawned: ${name}`);
      return;
    }
  }
  
  for (const role in roleLimits) {
    const roleName = role as Role;
    const creepsWithRole = Object.values(Game.creeps).filter(
        (c: Creep) => c.memory.role === roleName
    );      

    if (creepsWithRole.length < roleLimits[roleName]) {
      const name = `${roleName}_${Game.time}`;
      const result = spawn.spawnCreep(roleBodies[roleName], name, {
        memory: { role: roleName },
      });

      if (result === OK) {
        console.log(`Spawning ${roleName}: ${name}`);
        break; // only spawn one per tick
      }
    }
  }
}
