import { Role } from './types/roles';
import { cleanCreepMemory } from './managers/memoryManager';
import { manageSpawns } from './managers/spawnManager';
import { roleHarvester } from './roles/harvester';
import { roleUpgrader } from './roles/upgrader';

const roleModules: Record<Role, { run: (creep: Creep) => void }> = {
    harvester: roleHarvester,
    upgrader: roleUpgrader,
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
