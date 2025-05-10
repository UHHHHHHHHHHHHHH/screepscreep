import { Role } from "../types/roles";
import { getRoomPhase } from "../managers/roomManager";

export type RoleDemand = Record<Role, number>;

export function determineRoleDemand(room: Room): RoleDemand {
    const phase = getRoomPhase(room);   
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);

    // Early game logic: up to 2 harvesters per source
    const idealHarvesters = sources.length * 2;

    const harvestersAlive = Object.values(Game.creeps).filter(
        c => c.memory.role === 'harvester' && c.room.name === room.name
    ).length;

    // If not enough harvesters, suppress other roles
    switch (phase) {
        case 1:
          return {
            harvester: idealHarvesters,
            builder: 0,
            upgrader: harvestersAlive >= idealHarvesters ? 1 : 0,
          };
        case 2:
          return {
            harvester: idealHarvesters,
            builder: harvestersAlive >= idealHarvesters && constructionSites > 0 ? 1 : 0,
            upgrader: 0,
          };
        default:
          return {
            harvester: idealHarvesters,
            builder: constructionSites > 0 ? 1 : 0,
            upgrader: constructionSites > 0 ? 0 : 1,
          };
    }     
}
