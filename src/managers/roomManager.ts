export function getRoomPhase(room: Room): number {
    const level = room.controller?.level ?? 0;
    if (level < 2) {
      // Phase 1: basics (no RCL2 yet)
      return 1;
    }
  
    const sourcesCount = room.find(FIND_SOURCES).length;
  
    const extensionsCount = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
  
    const containersCount = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER
    }).length;
  
    // Phase 2: still placing _either_ extensions _or_ containers
    if (extensionsCount < 5 || containersCount < sourcesCount) {
      return 2;
    } else if (level < 3) {
      return 2.5;
    }

    if (level === 3) {
      return 3;
    }

    return 3.5
  }
  