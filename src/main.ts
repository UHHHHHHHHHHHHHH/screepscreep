import { Role } from './types/roles';
import { roleHarvester } from './role.harvester';
import { roleUpgrader } from './role.upgrader';

const roleModules: Record<Role, { run: (creep: Creep) => void }> = {
  harvester: roleHarvester,
  upgrader: roleUpgrader,
};

export function loop() {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;

    roleModules[role]?.run(creep);
  }
}
