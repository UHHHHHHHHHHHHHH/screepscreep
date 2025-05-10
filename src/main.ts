import { Role } from './types/roles';
import { roleHarvester } from './role.harvester';
import { roleUpgrader } from './role.upgrader';
import { manageSpawns } from './spawnManager';

const roleModules: Record<Role, { run: (creep: Creep) => void }> = {
  harvester: roleHarvester,
  upgrader: roleUpgrader,
};

export const loop = function () {
  const spawn = Object.values(Game.spawns)[0];
  if (spawn) manageSpawns(spawn);

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;
    roleModules[role]?.run(creep);
  }
};
