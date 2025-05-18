/**
 * @fileoverview Defines the enumeration for creep roles used throughout the AI.
 * This ensures consistency and type safety when referring to different creep specializations.
 * @module types/roles
 */

// types/roles.ts
export enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}

/**
 * A union type representing all possible string values of the Role enum.
 * Useful for situations where the string literal type is preferred over the enum member.
 * @typedef {`${Role}`} RoleType
 */
export type RoleType = `${Role}`;