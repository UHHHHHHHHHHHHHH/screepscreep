// types/roles.ts
export enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}

// and if you really need a union type too:
export type RoleType = `${Role}`;
