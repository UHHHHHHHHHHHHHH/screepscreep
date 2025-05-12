import { planAndBuildRoads } from "./roadManager";
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
            planAndBuildRoads(room);
            break;
        case 3:
            buildExtensions(room);
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

export function placeContainersNearSources(room: Room): void {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return;

    if (!room.memory.containerPositions) {
        room.memory.containerPositions = {};
    }

    for (const source of room.find(FIND_SOURCES)) {
        // skip if we’ve already queued/placed one
        if (room.memory.containerPositions[source.id]) continue;

        console.log("no memory of this source having a container", source)

        // build & filter only truly free adjacencies
        const freeTiles = OFFSETS
            .map(([dx, dy]) => new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name))
            .filter(pos => {
                // no walls
                if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
                // no existing structures or pending sites
                if (pos.lookFor(LOOK_STRUCTURES).length > 0) return false;
                if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) return false;
                return true;
            });

        if (freeTiles.length === 0) {
            // nowhere to put it (all spots blocked)
            continue;
        }

        // pick the free tile closest to spawn
        freeTiles.sort((a, b) =>
            spawn.pos.getRangeTo(a) - spawn.pos.getRangeTo(b)
        );

        const target = freeTiles[0];
        const res = room.createConstructionSite(
            target.x,
            target.y,
            STRUCTURE_CONTAINER
        );

        if (res === OK) {
            room.memory.containerPositions[source.id] = { x: target.x, y: target.y };
            console.log(
                `✏️ Placed container for source ${source.id} at (${target.x},${target.y})`
            );
        } else {
            // If it still somehow fails, you can log or handle retry logic here
            console.log(`❌ Failed to place container at (${target.x},${target.y}): ${res}`);
        }
    }
}
