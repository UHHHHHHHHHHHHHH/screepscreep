import { Role } from "../types/roles";
import { getRoomPhase } from "../managers/roomManager";
import { countCreepsByRole } from "../managers/creepManager";

export type RoleDemand = Record<Role, number>;

const allRoles = Object.values(Role) as Role[];

export function isRoleDemandSatisfied(room: Room): boolean {
    const demand = determineRoleDemand(room);
    const counts = countCreepsByRole(room);

    for (const role of allRoles) {
        if (counts[role] < demand[role]) {
            return false;
        }
    }
    return true;
}

function sourcesAreFilled(room: Room): boolean {
    const sources = room.find(FIND_SOURCES);
  
    return sources.every(source => {
      const inRoom = (c: Creep) => c.room.name === room.name;
      const bySource = (c: Creep) => c.memory.sourceId === source.id;
  
      const miners = Object.values(Game.creeps)
        .filter(c => inRoom(c) && c.memory.role === Role.Miner && bySource(c))
        .length;
      if (miners >= 1) return true;
  
      const harvesters = Object.values(Game.creeps)
        .filter(c => inRoom(c) && c.memory.role === Role.Harvester && bySource(c))
        .length;
      return harvesters >= 2;
    });
  }

// build a fresh zeroed demand record
function zeroDemand(): RoleDemand {
    return allRoles.reduce((acc, role) => {
        acc[role] = 0;
        return acc;
    }, {} as RoleDemand);
}

export function determineRoleDemand(room: Room): RoleDemand {
    const phase = getRoomPhase(room);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);
    const idealHarvesters = sources.length * 2;

    // start from a zeroed record
    const base = zeroDemand();

    switch (phase) {
        case 1:
            return {
                ...base,
                harvester: idealHarvesters,
                upgrader: sourcesAreFilled(room) ? 1 : 0,
            };
        case 2:
            const containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER,
            }) as StructureContainer[];

            return {
                ...base,
                harvester: containers.length >= 1 ? idealHarvesters / 2 : idealHarvesters,
                builder: sourcesAreFilled(room) && constructionSites > 0 ? 2 : 1,
                hauler: containers.length >= 1 ? 1 : 0,
                miner: containers.length >= 1 ? 1: 0
            };
        case 2.5:
            return {
                ...base,
                miner: sources.length,
                hauler: sources.length,
                builder: sourcesAreFilled(room) ? 1 : 0,
                upgrader: sourcesAreFilled(room) && constructionSites > 0 ? 0 : 1,
            };
        default:
            return {
                ...base,
                harvester: idealHarvesters,
                builder: constructionSites > 0 ? 1 : 0,
                upgrader: constructionSites > 0 ? 0 : 1,
            };
    }
}
