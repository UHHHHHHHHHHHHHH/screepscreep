export interface RoomResourceStats {
    energyInStructures: number;   // energy in spawn/extensions/storage/container
    energyInPiles: number;        // dropped energy on ground
    energyInTransit: number;      // carried by creeps in room
    totalEnergy: number;          // combined energy (structures + piles + carried)
    tickLastUpdated: number;
}

export function updateRoomResourceStats(room: Room): void {

    if (!room.memory.resourceStats) {
        room.memory.resourceStats = {} as RoomResourceStats;
    }

    const stats: RoomResourceStats = room.memory.resourceStats ??= {
        energyInStructures: 0,
        energyInPiles: 0,
        energyInTransit: 0,
        totalEnergy: 0,
        tickLastUpdated: 0,
    };

    // Energy in structures (including spawns, extensions, containers, storage, terminals)
    const energyInStructures = room.find(FIND_STRUCTURES).reduce((sum, s) => {
        if ("store" in s && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            return sum + s.store.getUsedCapacity(RESOURCE_ENERGY)!;
        }
        return sum;
    }, 0);

    // Dropped energy on ground
    const energyInPiles = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY
    }).reduce((sum, r) => sum + r.amount, 0);

    // Energy carried by creeps in this room
    const energyInTransit = room.find(FIND_MY_CREEPS).reduce((sum, c) => {
        return sum + (c.store?.getUsedCapacity(RESOURCE_ENERGY) || 0);
    }, 0);

    const totalEnergy = energyInStructures + energyInPiles + energyInTransit;

    // ✅ Update memory
    stats.energyInStructures = energyInStructures;
    stats.energyInPiles = energyInPiles;
    stats.energyInTransit = energyInTransit;
    stats.totalEnergy = totalEnergy;
    stats.tickLastUpdated = Game.time;
}

export function getRoomResourceStats(room: Room): RoomResourceStats {
    if (!room.memory.resourceStats || room.memory.resourceStats.tickLastUpdated !== Game.time) {
        updateRoomResourceStats(room);
    }
    return room.memory.resourceStats!;
}
