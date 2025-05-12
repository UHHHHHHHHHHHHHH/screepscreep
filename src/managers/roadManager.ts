export function planAndBuildRoads(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const controller = room.controller;
    if (!spawn || !controller) return;

    // 1) If we haven't yet computed our full road network, do it now:
    if (!room.memory.roadSitesPlanned) {
        const planned: { x: number; y: number }[] = [];

        // helper: add unique coords
        function addPath(path: RoomPosition[]) {
            for (const pos of path) {
                const key = `${pos.x},${pos.y}`;
                if (!planned.find(p => p.x === pos.x && p.y === pos.y)) {
                    planned.push({ x: pos.x, y: pos.y });
                }
            }
        }

        // A) source-container ↔ spawn
        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            // container pos from memory
            const mem = room.memory.containerPositions?.[source.id];
            if (!mem) continue; // no container yet
            const containerPos = new RoomPosition(mem.x, mem.y, room.name);

            // path from container → spawn
            const path1 = PathFinder.search(
                containerPos,
                { pos: spawn.pos, range: 1 },
                {
                    plainCost: 2,
                    swampCost: 10,
                    roomCallback: (rName: string): boolean | CostMatrix => {
                        const roomVis = Game.rooms[rName];
                        if (!roomVis) {
                            // skip custom CostMatrix for rooms we're not in:
                            return false;
                        }
                        const costs = new PathFinder.CostMatrix();
                        roomVis.find(FIND_STRUCTURES).forEach(s => {
                            if (s.structureType === STRUCTURE_ROAD) {
                                costs.set(s.pos.x, s.pos.y, 1);
                            }
                        });
                        return costs;
                    }
                }
            ).path;
            addPath(path1);
        }

        // B) spawn ↔ controller
        const path2 = PathFinder.search(
            spawn.pos,
            { pos: controller.pos, range: 3 },  // keep rampart range in mind
            { plainCost: 2, swampCost: 10 }
        ).path;
        addPath(path2);

        room.memory.roadSitesPlanned = planned;
    }

    // 2) Each tick, place at most N sites (to spread CPU)
    const planned = room.memory.roadSitesPlanned!;
    let placed = 0;
    for (const { x, y } of planned) {
        if (placed >= 5) break;  // throttle to 5 new sites per tick
        // skip if structure or site already exists
        const pos = new RoomPosition(x, y, room.name);
        if (pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD)) continue;
        if (pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_ROAD)) continue;

        if (room.createConstructionSite(x, y, STRUCTURE_ROAD) === OK) {
            placed++;
        }
    }
}
