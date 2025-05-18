/**
 * @fileoverview Defines configurations for creep roles, primarily detailing
 * their body part compositions, energy requirements, and specific body generation flags.
 * These configurations are used by `src/roles/roleBodies.ts` to dynamically
 * generate creep bodies based on role and available energy.
 * @module roles/roleConfigs
 */

import { Role } from "../types/roles";

/**
 * @interface RoleConfig
 * @description Defines the configuration for a specific creep role,
 * guiding how its body should be constructed.
 */
export interface RoleConfig {
  /**
   * @property {Partial<Record<BodyPartConstant, number>>} ratio
   * @description The desired ratio of body parts for this role (e.g., {work: 1, carry: 1, move: 1}).
   * Unless `dontRepeatBody` is true, this ratio is repeated as many times as energy allows,
   * up to the 50-part limit.
   */
  ratio: Partial<Record<BodyPartConstant, number>>;

  /**
   * @property {number} minEnergyForRatio
   * @description The minimum room energyAvailable required to attempt spawning this role
   * using its `ratio` and potentially repeating it. If the room's energyAvailable
   * is below this threshold, the `fallbackBody` will be used instead.
   */
  minEnergyForRatio: number;

  /**
   * @property {BodyPartConstant[]} [fallbackBody]
   * @description An optional, fixed body definition to use if the `minEnergyForRatio`
   * requirement is not met. If this is undefined and the energy is too low for the ratio,
   * a very basic body (e.g., [WORK, CARRY, MOVE]) might be used by the body generation logic,
   * or spawning might fail if the resulting body is empty.
   */
  fallbackBody?: BodyPartConstant[];

  /**
   * @property {boolean} [dontRepeatBody]
   * @description If true, the `ratio` defines the *exact* and *complete* body to be built,
   * and it should not be repeated. The body generation logic should aim to build precisely
   * this set of parts if `minEnergyForRatio` (which should ideally match the cost of this exact body)
   * is met. No additional parts should be added even if surplus energy is available.
   * This is useful for roles like Miners that often have a fixed, optimal design
   * (e.g., 5 WORK parts and 1 MOVE part) and do not benefit from scaling beyond that.
   *
   * *Current Observation (as per user feedback): The logic in `getBodyForRole` might not fully
   * adhere to preventing additional parts when `dontRepeatBody` is true. This documentation
   * reflects the intended design.*
   */
  dontRepeatBody?: boolean;
}

/**
 * @constant {Record<Role, RoleConfig>} roleConfigs
 * @description A mapping of `Role` enums to their `RoleConfig` objects.
 * This serves as the central definition for how different creep roles should be built,
 * specifying their ideal part ratios, fallback options, and body generation flags.
 */
export const roleConfigs: Record<Role, RoleConfig> = {
  harvester: {
    ratio: { work: 3, carry: 1, move: 1 },
    minEnergyForRatio: 400, // Cost of 3W,1C,1M = 300+50+50 = 400
    fallbackBody: [WORK, WORK, CARRY, MOVE], // Cost of 2W,1C,1M = 200+50+50 = 300
  },
  miner: {
    // Intended for exactly 5 WORK, 1 MOVE. Cost = 5*100 + 1*50 = 550
    ratio: { work: 5, move: 1 },
    minEnergyForRatio: 550, // Should match the cost of the fixed body
    dontRepeatBody: true
    // No fallbackBody means if 550 energy isn't available, it might try to scale down
    // the ratio (which is not intended here) or fail to spawn if it results in an empty body.
    // A `fallbackBody: [WORK, MOVE]` could be an option for very low energy scenarios.
  },
  builder: {
    ratio: { work: 2, carry: 2, move: 2 },
    minEnergyForRatio: 400, // Cost of 2W,2C,2M = 200+100+100 = 400
    fallbackBody: [WORK, CARRY, CARRY, MOVE, MOVE], // Cost of 1W,2C,2M = 100+100+100 = 300
  },
  upgrader: {
    ratio: { work: 3, carry: 2, move: 3 }, // Example: Targetting more WORK parts for higher RCLs
    minEnergyForRatio: 550, // Cost of 3W,2C,3M = 300+100+150 = 550
    fallbackBody: [WORK, WORK, CARRY, MOVE], // Cost of 2W,1C,1M = 300
  },
  hauler: {
    ratio: { carry: 6, move: 3 }, // Ratio implies 2 CARRY for every 1 MOVE
    minEnergyForRatio: 450, // Cost of 6C,3M = 300+150 = 450
    fallbackBody: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], // Cost of 4C,2M = 200+100 = 300
  },
};