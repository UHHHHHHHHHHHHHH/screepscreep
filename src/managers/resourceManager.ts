export interface RoomResourceStats {
    energyInStructures: number;       // All structures combined
    energyInPiles: number;
    energyInTransit: number;
    totalEnergy: number;
    energyAvailable: number;          // Direct from room.energyAvailable (spawns/extensions)
    energyCapacityAvailable: number;  // Direct from room.energyCapacityAvailable
    tickLastUpdated: number;
}

export function updateRoomResourceStats(room: Room): void {
    if (!room.memory.resourceStats) {
        room.memory.resourceStats = {
            energyInStructures: 0,
            energyInPiles: 0,
            energyInTransit: 0,
            totalEnergy: 0,
            energyAvailable: 0,
            energyCapacityAvailable: 0,
            tickLastUpdated: 0,
        };
    }

    const stats = room.memory.resourceStats!;

    const energyInStructures = room.find(FIND_STRUCTURES).reduce((sum, s) => {
        if ("store" in s && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            return sum + s.store.getUsedCapacity(RESOURCE_ENERGY)!;
        }
        return sum;
    }, 0);

    const energyInPiles = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY
    }).reduce((sum, r) => sum + r.amount, 0);

    const energyInTransit = room.find(FIND_MY_CREEPS).reduce((sum, c) => {
        return sum + (c.store?.getUsedCapacity(RESOURCE_ENERGY) || 0);
    }, 0);

    const totalEnergy = energyInStructures + energyInPiles + energyInTransit;

    stats.energyInStructures = energyInStructures;
    stats.energyInPiles = energyInPiles;
    stats.energyInTransit = energyInTransit;
    stats.totalEnergy = totalEnergy;
    stats.energyAvailable = room.energyAvailable;
    stats.energyCapacityAvailable = room.energyCapacityAvailable;
    stats.tickLastUpdated = Game.time;
}

export function getRoomResourceStats(room: Room): RoomResourceStats {
    if (!room.memory.resourceStats || room.memory.resourceStats.tickLastUpdated !== Game.time) {
        updateRoomResourceStats(room);
    }
    return room.memory.resourceStats!;
}

export function logRoomEnergyStats(room: Room): void {
    const stats = getRoomResourceStats(room);

    console.log(`📊 [${room.name}] Energy Stats:
    ➡️  Available: ${stats.energyAvailable} / ${stats.energyCapacityAvailable}
    🏦 In Structures: ${stats.energyInStructures}
    🪙 On Ground:     ${stats.energyInPiles}
    🚚 In Transit:    ${stats.energyInTransit}
    🔄 Total Energy:  ${stats.totalEnergy}
    (Updated tick: ${stats.tickLastUpdated})
    `);
}