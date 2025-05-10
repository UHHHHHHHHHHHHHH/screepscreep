import { getRoomPhase } from "./roomManager";

const extensionOffsets = [
    [0, -2], [1, -1], [2, 0], [1, 1],
    [0, 2], [-1, 1], [-2, 0], [-1, -1],
];

export function manageConstruction(room: Room): void {
    const phase = getRoomPhase(room);

    switch (phase) {
        case 2:
            buildExtensions(room);
            break;
        case 2.5:
            placeContainersNearSources(room);
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

function placeContainersNearSources(room: Room): void {
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
        const hasContainer = room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_CONTAINER &&
                s.pos.inRangeTo(source.pos, 1),
        }).length > 0;

        const siteExists = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s =>
                s.structureType === STRUCTURE_CONTAINER &&
                s.pos.inRangeTo(source.pos, 1),
        }).length > 0;

        if (hasContainer || siteExists) continue;

        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1],
        ];

        for (const [dx, dy] of offsets) {
            const x = source.pos.x + dx;
            const y = source.pos.y + dy;
            const terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0];
            if (terrain === "wall") continue;

            const blocked =
                room.lookForAt(LOOK_STRUCTURES, x, y).length > 0 ||
                room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0;

            if (!blocked) {
                const result = room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                if (result === OK) {
                    console.log(`📦 Placed container near ${source.id} at (${x}, ${y})`);
                }
                break;
            }
        }
    }
}
