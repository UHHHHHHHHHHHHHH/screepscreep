export function getRoomPhase(room: Room): number {
    const level = room.controller?.level ?? 0;
    if (level < 2) return 1;

    const extensions = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;

    if (extensions < 5) return 2; // Still building extensions

    const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    }).length;

    if (containers < room.find(FIND_SOURCES).length) return 2.5; // Still placing containers

    return level; // Full CL2 economy
}
