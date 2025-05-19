/**
 * @fileoverview Manages the planning and construction of roads within a room.
 * It identifies key paths (e.g., from source containers to spawn, spawn to controller)
 * and incrementally places road construction sites along these paths.
 * The planning phase is done once and stored in memory, while construction is throttled
 * to manage CPU usage.
 * @module managers/roadManager
 */

/**
 * The number of road construction sites to place per execution of `planAndBuildRoads`,
 * if called every tick. This helps throttle CPU usage.
 * Adjust based on how frequently `manageConstruction` (and thus this function) is called.
 * If `planAndBuildRoads` is called by `manageConstruction` which runs every 10 ticks,
 * then 5 sites per call means 0.5 sites per tick on average for this part.
 */
const ROAD_CONSTRUCTION_SITES_PER_EXECUTION = 5;

/**
 * Options for PathFinder when planning roads.
 * Roads should be cheap (cost 1), plains moderate (2), swamps expensive (10).
 */
const ROAD_PATHFINDER_OPTS: PathFinderOpts = {
    plainCost: 2,
    swampCost: 10,
    roomCallback: (roomName: string): CostMatrix | boolean => {
        const room = Game.rooms[roomName];
        if (!room) {
            // If we don't have visibility of the room, don't use a custom CostMatrix.
            // PathFinder will use default terrain costs.
            return false;
        }
        const costs = new PathFinder.CostMatrix();
        // Set existing roads to cost 1 to encourage PathFinder to use them.
        room.find(FIND_STRUCTURES).forEach(struct => {
            if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            }
            // Optionally, make other structures impassable for road planning if desired
            // else if (struct.structureType !== STRUCTURE_RAMPART && struct.structureType !== STRUCTURE_CONTAINER) {
            //     costs.set(struct.pos.x, struct.pos.y, 0xff);
            // }
        });
        // Optionally, iterate construction sites as well if some should be avoided or preferred.
        return costs;
    }
};

/**
 * Plans and constructs roads in a given room.
 *
 * The function operates in two main stages:
 * 1.  **Planning (One-time per room memory reset):**
 *     If `room.memory.roadSitesPlanned` is not set, it calculates paths between:
 *     a.  Each source's container (if defined in `room.memory.containerPositions`) and the primary spawn.
 *     b.  The primary spawn and the room controller.
 *     The coordinates of these paths are stored uniquely in `room.memory.roadSitesPlanned`.
 *     This uses `PathFinder.search` with costs that prefer existing roads and avoid swamps.
 *
 * 2.  **Construction (Incremental):**
 *     It iterates through the `room.memory.roadSitesPlanned`. For each coordinate, if no road
 *     structure or construction site already exists, it attempts to create a road construction site.
 *     This process is throttled by `ROAD_CONSTRUCTION_SITES_PER_EXECUTION` to limit CPU usage per call.
 *
 * This function is typically called periodically (e.g., by `constructionManager`).
 *
 * @param {Room} room - The room in which to plan and build roads.
 * @returns {void}
 */
export function planAndBuildRoads(room: Room): void {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const controller = room.controller;

    // Essential structures must exist for road planning.
    if (!spawn || !controller) {
        if (Game.time % 50 === 0) { // Log an error periodically if this happens
            console.log(`[${room.name}] RoadManager: Missing spawn or controller, cannot plan roads.`);
        }
        return;
    }

    // 1. Planning Stage: Compute road network if not already done.
    if (!room.memory.roadSitesPlanned) {
        console.log(`[${room.name}] RoadManager: Planning initial road network.`);
        const plannedPathCoordinates: { x: number; y: number }[] = [];
        const uniqueCoordinateKeys = new Set<string>(); // To ensure unique coordinates

        /**
         * Helper function to add unique room positions from a path to the planned list.
         * @param {RoomPosition[]} path - An array of RoomPosition objects.
         */
        function addPathToPlanned(path: RoomPosition[]): void {
            for (const pos of path) {
                const key = `${pos.x},${pos.y}`;
                if (!uniqueCoordinateKeys.has(key)) {
                    plannedPathCoordinates.push({ x: pos.x, y: pos.y });
                    uniqueCoordinateKeys.add(key);
                }
            }
        }

        // A. Paths from Source Containers to Spawn
        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            const containerMemPos = room.memory.containerPositions?.[source.id];
            if (!containerMemPos) {
                // If a source doesn't have a designated container position yet, skip pathing for it.
                // Roads to these sources might be planned later once containers are placed.
                continue;
            }
            const containerActualPos = new RoomPosition(containerMemPos.x, containerMemPos.y, room.name);

            // Check if a container actually exists at the memory position. Path if it does.
            const structuresAtPos = containerActualPos.lookFor(LOOK_STRUCTURES);
            const constructionSitesAtPos = containerActualPos.lookFor(LOOK_CONSTRUCTION_SITES);
            const hasContainer = structuresAtPos.some(s => s.structureType === STRUCTURE_CONTAINER) ||
                                 constructionSitesAtPos.some(cs => cs.structureType === STRUCTURE_CONTAINER);

            if (hasContainer) {
                const pathToSpawn = PathFinder.search(
                    containerActualPos,
                    { pos: spawn.pos, range: 1 }, // Target spawn with range 1
                    ROAD_PATHFINDER_OPTS
                ).path;
                addPathToPlanned(pathToSpawn);
            }
        }

        // B. Path from Spawn to Controller
        const pathToController = PathFinder.search(
            spawn.pos,
            { pos: controller.pos, range: 3 }, // Target controller with range 3 (for upgraders)
            ROAD_PATHFINDER_OPTS // Uses the same opts, could be different if needed
        ).path;
        addPathToPlanned(pathToController);

        // TODO: Consider other important paths:
        // - Spawn to other spawns (if multiple)
        // - Spawn/Controller to room exits for remote mining/operations
        // - Around defensive structures like towers/ramparts

        room.memory.roadSitesPlanned = plannedPathCoordinates;
        console.log(`[${room.name}] RoadManager: Planned ${plannedPathCoordinates.length} road segments.`);
    }

    // 2. Construction Stage: Incrementally place construction sites.
    const roadPlan = room.memory.roadSitesPlanned; // roadPlan will be defined if planning stage completed
    if (!roadPlan || roadPlan.length === 0) {
        // No roads planned, or all have been processed for construction site placement.
        return;
    }

    let sitesPlacedThisCall = 0;
    const sitesToProcess = [...roadPlan]; // Iterate over a copy in case we modify it (though we don't here)

    for (const coord of sitesToProcess) {
        if (sitesPlacedThisCall >= ROAD_CONSTRUCTION_SITES_PER_EXECUTION) {
            break; // Stop if throttle limit reached
        }

        const currentPos = new RoomPosition(coord.x, coord.y, room.name);

        // Check if a road or road construction site already exists at this position.
        const existingStructures = currentPos.lookFor(LOOK_STRUCTURES);
        const existingConstructionSites = currentPos.lookFor(LOOK_CONSTRUCTION_SITES);

        const hasRoad = existingStructures.some(s => s.structureType === STRUCTURE_ROAD);
        const hasRoadSite = existingConstructionSites.some(cs => cs.structureType === STRUCTURE_ROAD);

        if (hasRoad || hasRoadSite) {
            // Road already exists or is being built, skip.
            // Consider removing this coord from room.memory.roadSitesPlanned if it's confirmed built
            // to optimize future iterations, but this adds complexity to state management.
            // For now, just skipping is fine.
            continue;
        }

        // Check if the terrain allows building a road (not a wall)
        if (room.getTerrain().get(coord.x, coord.y) === TERRAIN_MASK_WALL) {
            // Cannot build road on a wall. This segment should ideally not be in the plan
            // if PathFinder was configured correctly or if structures block pathing.
            // Log warning if this happens.
            if (Game.time % 100 === 20) { // Log periodically
                 console.log(`[${room.name}] RoadManager Warning: Tried to place road on wall at ${coord.x},${coord.y}. Pathing issue?`);
            }
            continue;
        }

        const result = room.createConstructionSite(coord.x, coord.y, STRUCTURE_ROAD);
        if (result === OK) {
            sitesPlacedThisCall++;
        } else if (result !== ERR_FULL && result !== ERR_INVALID_TARGET) {
            // Log other errors like ERR_INVALID_ARGS, ERR_RCL_NOT_ENOUGH if they occur
            // ERR_FULL means too many construction sites in room.
            // ERR_INVALID_TARGET might mean terrain issue not caught or structure blocking.
            if (Game.time % 20 === 10) { // Log periodically
                console.log(`[${room.name}] RoadManager: Failed to create road site at ${coord.x},${coord.y} with error ${result}`);
            }
        }
    }

    // Optional: If all planned sites have been attempted/built, clear the plan to allow replanning
    // if major room layout changes occur or if new paths are needed.
    // This requires careful state management to know when "all done" vs "throttled".
    // A simpler approach is to manually clear `room.memory.roadSitesPlanned` via console if replanning is desired.
    // if (sitesPlacedThisCall === 0 && sitesToProcess.every(coord => {
    //     const pos = new RoomPosition(coord.x, coord.y, room.name);
    //     return pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD) ||
    //            pos.lookFor(LOOK_CONSTRUCTION_SITES).some(cs => cs.structureType === STRUCTURE_ROAD) ||
    //            room.getTerrain().get(coord.x, coord.y) === TERRAIN_MASK_WALL;
    // })) {
    //     console.log(`[${room.name}] RoadManager: All planned road sites seem processed. Consider clearing memory for replan if needed.`);
    //     // delete room.memory.roadSitesPlanned; // Uncomment to auto-clear after completion
    // }
}