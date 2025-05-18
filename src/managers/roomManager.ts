/**
 * @fileoverview Manages room-specific state and progression, primarily by determining the
 * current "phase" of a room. The room phase is a numerical indicator of the room's
 * development stage, based on controller level (RCL), and the presence of key
 * structures like extensions and containers. This phase information is then used
 * by other managers to tailor their logic (e.g., creep role demands, construction priorities).
 * @module managers/roomManager
 */

/**
 * Determines the current operational phase of a room based on its controller level (RCL)
 * and the presence of key infrastructure like extensions and containers.
 *
 * The phases are defined as follows:
 * - **Phase 1 (RCL < 2):** Initial setup. Focus is on basic harvesting and upgrading to RCL 2.
 *   No extensions or containers are expected yet.
 * - **Phase 2 (RCL 2, Extensions < 5 OR Containers < Sources):**
 *   The room has reached RCL 2 but is still in the process of building its initial
 *   set of 5 extensions or placing containers for all its energy sources.
 *   This phase focuses on bootstrapping the energy economy with these early structures.
 * - **Phase 2.5 (RCL 2, All initial Extensions & Containers built):**
 *   The room is at RCL 2, has built its first 5 extensions, and has placed containers
 *   for all sources. It's now stabilizing before pushing to RCL 3. Focus might shift
 *   to more upgraders, road construction, or preparing for further expansion.
 * - **Phase 3 (RCL 3):** The room has reached RCL 3. This typically unlocks more extensions,
 *   towers, and potentially more complex creep roles or strategies.
 * - **Phase 3.5 (RCL > 3):** Represents further development beyond RCL 3, where the room
 *   is considered more mature.
 *
 * This phase system allows other managers (e.g., `roleDemandManager`, `constructionManager`)
 * to adapt their behavior to the room's current capabilities and needs.
 *
 * @param {Room} room - The room object to evaluate.
 * @returns {number} The calculated phase of the room.
 */
export function getRoomPhase(room: Room): number {
  const controller = room.controller;
  const level = controller?.level ?? 0; // Default to 0 if no controller or level

  // Phase 1: Controller level is less than 2.
  // This is the earliest stage, focusing on getting to RCL 2.
  if (level < 2) {
      return 1;
  }

  // For phases 2 and above, we need to know about sources, extensions, and containers.
  const sourcesCount = room.find(FIND_SOURCES).length;
  const extensionsCount = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
  }).length;
  const containersCount = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER
  }).length;

  // Phase 2: RCL is 2, but essential early infrastructure is still being built.
  // This includes the first 5 extensions (standard unlock at RCL 2) OR
  // placing a container for each energy source.
  if (level === 2) {
      // Check if we are still missing the first 5 extensions OR
      // if we haven't placed containers for all sources yet.
      // Note: CONTROLLER_STRUCTURES.extension[2] is 5.
      const requiredExtensionsForRCL2 = CONTROLLER_STRUCTURES.extension[2] || 5;
      if (extensionsCount < requiredExtensionsForRCL2 || (sourcesCount > 0 && containersCount < sourcesCount)) {
          return 2;
      }
      // If RCL is 2 and the above conditions are met (5 extensions AND containers for sources),
      // it's considered a more developed RCL 2 stage.
      return 2.5;
  }

  // Phase 3: Controller level is exactly 3.
  // This unlocks more extensions, potentially towers, etc.
  if (level === 3) {
      return 3;
  }

  // Phase 3.5: Controller level is greater than 3.
  // Represents rooms that are more mature and have progressed beyond RCL 3.
  // This could be further subdivided in the future (e.g., Phase 4, Phase 5)
  // based on RCL or other criteria.
  if (level > 3) {
      return 3.5; // Or simply `level` if you want phase to directly map to RCL > 3
  }

  // Fallback, though logically covered by above conditions.
  // If level is somehow >= 2 but not 2, 3, or >3, this would be hit.
  // This can be treated as an "undefined" or advanced phase.
  // For simplicity, defaulting to a higher phase number if logic is extended later.
  return level; // Or a specific "unknown/advanced" phase number like 99.
}
