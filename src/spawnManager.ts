import { Role } from "./types/roles";

type SpawnRequest = {
  role: Role;
  body: BodyPartConstant[];
};

const roleLimits: Record<Role, number> = {
  harvester: 2,
  upgrader: 1,
};

const roleBodies: Record<Role, BodyPartConstant[]> = {
  harvester: [WORK, CARRY, MOVE, MOVE],
  upgrader: [WORK, CARRY, MOVE, MOVE],
};

export function manageSpawns(spawn: StructureSpawn) {
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
