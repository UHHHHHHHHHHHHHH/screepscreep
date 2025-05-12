import { getRoomPhase } from "./roomManager";

const CONSTRUCTION_INTERVAL = 10;

const extensionOffsets = [
    [0, -2], [1, -1], [2, 0], [1, 1],
    [0, 2], [-1, 1], [-2, 0], [-1, -1],
];

export function manageConstruction(room: Room): void {
    if (Game.time % CONSTRUCTION_INTERVAL !== 0) return;

    const phase = getRoomPhase(room);

    switch (phase) {
        case 2:
            buildExtensions(room);
            placeContainersNearSources(room);
            break;
        case 2.5:
            break;
    }
}

function buildExtensions(room: Room): void {
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

    let placed = 0;
    for (const [dx, dy] of extensionOffsets) {
        if (placed >= missing) return;
        const x = spawn.pos.x + dx;
        const y = spawn.pos.y + dy;

        const blocked =
            room.lookForAt(LOOK_STRUCTURES, x, y).length > 0 ||
            room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0;

        if (!blocked) {
            const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
            if (result === OK) placed++;
        }
    }
}

const OFFSETS: [number, number][] = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
];

export function placeContainersNearSources(room: Room) {
    // ensure our cache object exists
    if (!room.memory.containerPositions) {
        room.memory.containerPositions = {};
    }

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return;

    for (const source of room.find(FIND_SOURCES)) {
        // if we've already chosen & placed (or queued) a container here, skip
        if (room.memory.containerPositions[source.id]) continue;

        // build all valid adj positions
        const candidates: RoomPosition[] = OFFSETS.map(([dx, dy]) =>
            new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name)
        ).filter(pos => {
            // terrain must not be wall
            if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
            return true;
        });

        if (candidates.length === 0) continue;

        // pick the one that is closest to spawn
        let best = candidates[0];
        let bestRange = spawn.pos.getRangeTo(best);

        for (let i = 1; i < candidates.length; i++) {
            const r = spawn.pos.getRangeTo(candidates[i]);
            if (r < bestRange) {
                bestRange = r;
                best = candidates[i];
            }
        }

        // try to place the site once
        const res = room.createConstructionSite(best.x, best.y, STRUCTURE_CONTAINER);
        if (res === OK) {
            // cache so we never try again
            room.memory.containerPositions[source.id] = { x: best.x, y: best.y };
            console.log(`✏️ queued container @ ${best.x},${best.y} for source ${source.id}`);
        }
        // if it failed (blocked by something unexpected), we’ll try again next tick
    }
}
