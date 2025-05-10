const extensionOffsets = [
    [ 0, -2], [ 1, -1], [ 2,  0], [ 1,  1],
    [ 0,  2], [-1,  1], [-2,  0], [-1, -1],
];

export function manageConstruction(room: Room): void {
    const controller = room.controller;
    if (!controller || !controller.my || controller.level < 2) return;
  
    const maxExtensions = CONTROLLER_STRUCTURES.extension[controller.level];
    const built = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION,
    }).length;
  
    const queued = room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION,
    }).length;
  
    const total = built + queued;
    const missing = maxExtensions - total;
  
    if (missing <= 0) return;
  
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return;

    // Offsets for a simple ring around the spawn (1 tile gap)

    // Try placing up to X missing extensions near the spawn
    let placed = 0;
    for (const [dx, dy] of extensionOffsets) {
        if (placed >= missing) return;
      
        const x = spawn.pos.x + dx;
        const y = spawn.pos.y + dy;
      
        const hereIsBlocked =
          room.lookForAt(LOOK_STRUCTURES, x, y).length > 0 ||
          room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0;
      
        if (!hereIsBlocked) {
          const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
          if (result === OK) placed++;
        }
      }
  }
  