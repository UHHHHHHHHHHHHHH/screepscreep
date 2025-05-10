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
  
    // Try placing up to X missing extensions near the spawn
    let placed = 0;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (placed >= missing) return;
  
        const x = spawn.pos.x + dx;
        const y = spawn.pos.y + dy;
  
        if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
        if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
        if (room.createConstructionSite(x, y, STRUCTURE_EXTENSION) === OK) {
          placed++;
        }
      }
    }
  }
  