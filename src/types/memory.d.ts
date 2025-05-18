/**
 * @fileoverview Extends the global Screeps Memory interfaces with custom structures
 * used by this AI. This file is essential for type safety and understanding
 * the data stored in memory.
 * @module types/memory
 */

import { RoomResourceStats } from "../managers/resourceManager"; // Assuming RoomResourceStats is exported
import { Role } from "./roles";

// Ensure this augmentation is correctly applied globally
declare global {
    /**
     * @interface CreepMemory
     * @description Custom memory structure for individual creeps.
     */
    interface CreepMemory {
        /** @property {Role} role - The current assigned role of the creep. */
        role: Role;
        /** @property {boolean} [atCapacity] - Flag indicating if the creep's store is full (typically of energy). Used by roles to switch tasks. */
        atCapacity?: boolean;
        /** @property {number} [lockUntil] - Game tick until which the creep's role is locked, preventing reassignment by `roleManager`. */
        lockUntil?: number;
        /** @property {Id<Source>} [sourceId] - The ID of the source this creep is assigned to (e.g., for Harvesters, Miners). */
        sourceId?: Id<Source>;
        /** @property {Id<StructureContainer> | null} [containerId] - The ID of the container this creep is assigned to (e.g., for Haulers, or Miners to drop into). Null if not assigned or not applicable. */
        containerId?: Id<StructureContainer> | null;
        // Add any other role-specific memory properties here with comments
        // e.g., targetId?: Id<AnyStructure | ConstructionSite>;
        // e.g., working?: boolean; (alternative to atCapacity)
    }

    /**
     * @interface RoomMemory
     * @description Custom memory structure for individual rooms.
     */
    interface RoomMemory {
        /**
         * @property {{[sourceId: string]: { x: number, y: number }}} [containerPositions]
         * @description Stores the designated `RoomPosition` (as x, y coordinates) for containers near energy sources.
         * The key is the `Id<Source>`.
         */
        containerPositions?: {
            [sourceId: string]: { x: number, y: number };
        };
        /**
         * @property {SpawnRequest[]} [spawnQueue]
         * @description An ordered list of creeps to be spawned. Processed by `spawnManager`.
         */
        spawnQueue?: SpawnRequest[];
        /**
         * @property {Partial<Record<Role, number>>} [roleDemandOverrides]
         * @description Allows manual overriding of the calculated creep demand for specific roles in this room.
         */
        roleDemandOverrides?: Partial<Record<Role, number>>;
        /**
         * @property {{ x: number; y: number }[]} [roadSitesPlanned]
         * @description A list of coordinates where road construction sites should be placed. Used by `roadManager`.
         * Once a road is planned for a coordinate, it's added here.
         */
        roadSitesPlanned?: { x: number; y: number }[];
        /**
         * @property {RoomResourceStats} [resourceStats]
         * @description Cached statistics about resources in the room, updated periodically by `resourceManager`.
         */
        resourceStats?: RoomResourceStats;
        // Add any other room-specific memory properties here
        // e.g., phase?: number; (if you decide to store the room phase)
        // e.g., enemyThreatLevel?: number;
    }

    /**
     * @interface SpawnRequest
     * @description Defines the structure for a request in the room's spawn queue.
     */
    interface SpawnRequest {
        /** @property {Role} role - The role of the creep to be spawned. */
        role: Role;
        /** @property {any} [opts] - Optional parameters specific to the role or spawning process (e.g., target IDs). */
        opts?: any; // Consider making this more specific if possible, e.g., { sourceId?: Id<Source>, containerId?: Id<StructureContainer> }
        /** @property {number} timestamp - The game tick when this request was added to the queue. Useful for debugging or priority. */
        timestamp: number;
    }

    // If you have global memory settings, define them here under `interface Memory`
    // interface Memory {
    //   empire: any;
    //   uuid: number;
    //   log: any;
    // }
}

/**
 * This empty export is required to make this file a module when it only contains global declarations.
 * @see https://stackoverflow.com/questions/59419510/make-a-d-ts-file-a-module
 */
export { };