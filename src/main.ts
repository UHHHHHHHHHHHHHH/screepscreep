import { Role } from './types/roles';
import { BaseRole } from './roles/base';
import { cleanCreepMemory } from './managers/memoryManager';
import { manageSpawns } from './managers/spawnManager';
import { manageConstruction } from './managers/constructionManager';
import { UpgraderRole } from './roles/upgrader';
import { BuilderRole } from './roles/builder';
import { HarvesterRole } from './roles/harvester';
import { manageRoles } from './managers/roleManager';
import { MinerRole } from './roles/miner';
import { HaulerRole } from './roles/hauler';
import { profile } from './utils/profiler';
import { logRoomEnergyStats } from './managers/resourceManager';

const roleModules: Record<Role, BaseRole> = {
    harvester: new HarvesterRole(),
    builder: new BuilderRole(),
    upgrader: new UpgraderRole(),
    miner: new MinerRole(),
    hauler: new HaulerRole(),
};

export const loop = profile("main loop", function () {
    // const start = Game.cpu.getUsed();

    cleanCreepMemory();

    // manageRoles();

    const spawn = Object.values(Game.spawns)[0];
    if (spawn) manageSpawns(spawn);

    for (const room of Object.values(Game.rooms)) {
        manageConstruction(room);

        if (Game.time % 10 === 0) {
            logRoomEnergyStats(room)
        } 
    }

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = creep.memory.role;
        roleModules[role]?.run(creep);
    }

    // const end = Game.cpu.getUsed();
    // console.log(`⏱️ Tick CPU: ${(end - start).toFixed(2)}`);
});
