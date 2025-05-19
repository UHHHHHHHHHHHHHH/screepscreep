/**
 * @fileoverview Manages automated construction of structures within a room.
 * It operates based on the room's current "phase" (derived from controller level and
 * existing structures) to decide what to build next, such as extensions, containers
 * near sources, and roads. Construction tasks are throttled by `CONSTRUCTION_INTERVAL`.
 * @module managers/constructionManager
 */

import { planAndBuildRoads } from "./roadManager"; // For initiating road planning and building
import { getRoomPhase } from "./roomManager";     // To determine the current construction priorities

/**
 * Interval (in game ticks) at which the `manageConstruction` function will execute its logic.
 * This helps to distribute CPU load. For example, a value of 10 means construction logic
 * runs for a room once every 10 ticks.
 */
const CONSTRUCTION_INTERVAL = 10;

/**
 * Predefined relative offsets from a spawn to attempt placing extensions.
 * This creates a somewhat circular or clustered pattern around the first spawn.
 * Format: [dx, dy]
 */
const EXTENSION_OFFSETS: [number, number][] = [
    [0, -2], [1, -1], [2, 0], [1, 1],  // Outer ring
    [0, 2], [-1, 1], [-2, 0], [-1, -1],
    // Consider adding more layers or a more dynamic placement algorithm for higher RCLs
    // e.g., [2, -2], [2, 2], [-2, 2], [-2, -2] // Corners
    // [0, -3], [3, 0], [0, 3], [-3, 0] // Further out
];

/**
 * Relative offsets from a central point (like an energy source) to check for
 * suitable locations to place structures like containers.
 * These represent the 8 adjacent tiles.
 * Format: [dx, dy]
 */
const ADJACENT_OFFSETS: [number, number][] = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0], // Center tile (dx=0, dy=0) is excluded
    [-1, 1], [0, 1], [1, 1],
];

/**
 * Main function to manage construction tasks for a given room.
 * It is throttled by `CONSTRUCTION_INTERVAL`.
 * Based on the room's phase (determined by `getRoomPhase`), it delegates to
 * specific construction functions like `buildExtensions`, `placeContainersNearSources`,
 * or `planAndBuildRoads`.
 *
 * @param {Room} room - The room in which to manage construction.
 * @returns {void}
 */
export function manageConstruction(room: Room): void {
    // Throttle execution to save CPU
    if (Game.time % CONSTRUCTION_INTERVAL !== 0) {
        return;
    }

    const phase = getRoomPhase(room);

    // Switch construction strategy based on room phase
    switch (phase) {
        case 2: // Early RCL2: Focus on initial extensions and containers for sources
            buildExtensions(room);
            placeContainersNearSources(room);
            break;
        case 2.5: // Mid RCL2: Basic structures likely up, focus on road network
            planAndBuildRoads(room);
            break;
        case 3: // RCL3: More extensions become available
            buildExtensions(room);
            // Consider adding tower construction here
            break;
        case 3.5: // Higher RCL or catch-all for ongoing development
            // At this stage, it might be good to run all relevant construction checks,
            // as needs can be diverse (more extensions, containers for new remotes, roads to new areas).
            // Order might matter if one depends on another (e.g., roads to planned extension spots).
            placeContainersNearSources(room); // Ensure all sources have containers
            buildExtensions(room);            // Build any newly unlocked extensions
            planAndBuildRoads(room);          // Continue building/maintaining road network
            // Consider adding logic for other structures: towers, storage, terminal, labs, etc.
            break;
        // Add more cases for higher phases/RCLs with different priorities
        default:
            if (Game.time % (CONSTRUCTION_INTERVAL * 5) === 0) { // Log less frequently for unhandled phases
                // console.log(`[${room.name}] ConstructionManager: No specific construction tasks for phase ${phase}.`);
            }
            break;
    }
}

/**
 * Attempts to build extensions around the room's first spawn up to the maximum allowed
 * by the controller level.
 * It uses a predefined `EXTENSION_OFFSETS` pattern.
 *
 * @param {Room} room - The room in which to build extensions.
 * @returns {void}
 */
function buildExtensions(room: Room): void {
    const controller = room.controller;
    // Requires a visible, owned controller at RCL 2 or higher.
    if (!controller || !controller.my || controller.level < 2) {
        return;
    }

    const maxExtensionsAllowed = CONTROLLER_STRUCTURES.extension[controller.level];
    if (maxExtensionsAllowed === 0) return; // No extensions available at this RCL (e.g. RCL 1)

    const existingExtensions = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION,
    }).length;

    const queuedExtensionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION,
    }).length;

    const totalExtensions = existingExtensions + queuedExtensionSites;
    const missingExtensions = maxExtensionsAllowed - totalExtensions;

    if (missingExtensions <= 0) {
        return; // All allowed extensions are built or queued.
    }

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
        // Should not happen if controller.my is true, but good safeguard.
        return;
    }

    let extensionsPlacedThisCall = 0;
    for (const [dx, dy] of EXTENSION_OFFSETS) {
        if (extensionsPlacedThisCall >= missingExtensions) {
            break; // Stop if we've queued enough to meet the current RCL limit.
        }

        const targetX = spawn.pos.x + dx;
        const targetY = spawn.pos.y + dy;

        // Basic boundary check (0-49)
        if (targetX < 0 || targetX > 49 || targetY < 0 || targetY > 49) {
            continue;
        }

        const pos = new RoomPosition(targetX, targetY, room.name);

        // Check if the spot is blocked by existing structures or construction sites (of any type)
        // or if it's a wall.
        if (room.getTerrain().get(targetX, targetY) === TERRAIN_MASK_WALL ||
            pos.lookFor(LOOK_STRUCTURES).length > 0 ||
            pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) {
            continue; // Spot is blocked or a wall.
        }

        const result = room.createConstructionSite(targetX, targetY, STRUCTURE_EXTENSION);
        if (result === OK) {
            extensionsPlacedThisCall++;
        } else if (Game.time % 50 === 0 && result !== ERR_FULL) { // Log errors other than "too many sites" periodically
            console.log(`[${room.name}] Failed to place extension site at ${targetX},${targetY}: ${result}`);
        }
    }
}

/**
 * Places construction sites for containers near each energy source in the room.
 * It attempts to find a free tile adjacent to the source that is closest to the spawn.
 * It uses `room.memory.containerPositions` to remember where a container has been
 * planned or built for a source, avoiding redundant placement.
 * If a remembered container is missing, its memory entry is cleared.
 *
 * @param {Room} room - The room in which to place containers.
 * @returns {void}
 */
export function placeContainersNearSources(room: Room): void {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
        // A spawn is used for pathing reference; if none, can't optimally place.
        return;
    }

    if (!room.memory.containerPositions) {
        room.memory.containerPositions = {};
    }

    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
        const memoryPosition = room.memory.containerPositions[source.id];
        if (memoryPosition) {
            const pos = new RoomPosition(memoryPosition.x, memoryPosition.y, room.name);
            const hasExistingContainer = pos.lookFor(LOOK_STRUCTURES)
                .some(s => s.structureType === STRUCTURE_CONTAINER);
            const hasExistingSite = pos.lookFor(LOOK_CONSTRUCTION_SITES)
                .some(s => s.structureType === STRUCTURE_CONTAINER);

            if (hasExistingContainer || hasExistingSite) {
                continue; // Container already exists or is being built at the remembered spot.
            } else {
                // Container was remembered but is now missing. Clear memory to allow replanning.
                delete room.memory.containerPositions[source.id];
                console.log(`[${room.name}] Container for source ${source.id} at (${memoryPosition.x},${memoryPosition.y}) is missing. Cleared memory, will replan.`);
            }
        }
        // If we reach here, either no memory existed, or it was cleared. Time to find a spot.
        // Log this attempt once to avoid spam if it fails repeatedly.
        if (!memoryPosition && Game.time % (CONSTRUCTION_INTERVAL * 2) === 0) {
             console.log(`[${room.name}] Looking for container spot for source ${source.id}.`);
        }


        // Find all adjacent, buildable, unoccupied tiles around the source.
        const suitableTiles = ADJACENT_OFFSETS
            .map(([dx, dy]) => new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name))
            .filter(pos => {
                if (pos.x < 0 || pos.x > 49 || pos.y < 0 || pos.y > 49) return false; // Boundary check
                if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
                if (pos.lookFor(LOOK_STRUCTURES).length > 0) return false; // Includes other containers
                if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) return false;
                return true;
            });

        if (suitableTiles.length === 0) {
            if (Game.time % (CONSTRUCTION_INTERVAL * 5) === 0) { // Log periodically if no spot found
                console.log(`[${room.name}] No suitable adjacent spot found for container near source ${source.id}.`);
            }
            continue; // No valid spot to place a container.
        }

        // Sort suitable tiles by their path distance to the spawn to find the "most efficient" spot.
        suitableTiles.sort((a, b) =>
            spawn.pos.getRangeTo(a) - spawn.pos.getRangeTo(b) // Using getRangeTo for simplicity; PathFinder is more accurate but costlier
            // Consider PathFinder.search(spawn.pos, {pos: a, range:1}).cost vs PathFinder.search(spawn.pos, {pos: b, range:1}).cost
        );

        const chosenPosition = suitableTiles[0];
        const result = room.createConstructionSite(chosenPosition.x, chosenPosition.y, STRUCTURE_CONTAINER);

        if (result === OK) {
            room.memory.containerPositions[source.id] = { x: chosenPosition.x, y: chosenPosition.y };
            console.log(`[${room.name}] Placed container site for source ${source.id} at (${chosenPosition.x},${chosenPosition.y}).`);
        } else if (Game.time % 50 === 0 && result !== ERR_FULL) {
            console.log(`[${room.name}] Failed to place container site for source ${source.id} at (${chosenPosition.x},${chosenPosition.y}): ${result}`);
        }
    }
}
