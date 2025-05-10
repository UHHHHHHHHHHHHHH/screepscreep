import { Role } from './types/roles';
import { BaseRole } from './roles/base';
import { cleanCreepMemory } from './managers/memoryManager';
import { manageSpawns } from './managers/spawnManager';
import { UpgraderRole } from './roles/upgrader';
import { BuilderRole } from './roles/builder';
import { HarvesterRole } from './roles/harvester';

const roleModules: Record<Role, BaseRole> = {
    upgrader: new UpgraderRole(),
    builder: new BuilderRole(),
    harvester: new HarvesterRole(),
  };  

export const loop = function () {
    const start = Game.cpu.getUsed();

    cleanCreepMemory();

    const spawn = Object.values(Game.spawns)[0];
    if (spawn) manageSpawns(spawn);

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = creep.memory.role;
        roleModules[role]?.run(creep);
    }

    const end = Game.cpu.getUsed();
    console.log(`⏱️ Tick CPU: ${(end - start).toFixed(2)}`);
};
