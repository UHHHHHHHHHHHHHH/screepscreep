import {
    updateRoomResourceStats,
    getRoomResourceStats,
    logRoomEnergyStats,
    RoomResourceStats // Import for type usage
} from '../../src/managers/resourceManager';

// --- Constants ---
// @ts-ignore
global.RESOURCE_ENERGY = 'energy';
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.FIND_DROPPED_RESOURCES = 106;
// @ts-ignore
global.FIND_MY_CREEPS = 102;

// @ts-ignore
global.STRUCTURE_SPAWN = 'spawn';
// @ts-ignore
global.STRUCTURE_EXTENSION = 'extension';
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';
// @ts-ignore
global.STRUCTURE_STORAGE = 'storage';
// @ts-ignore
global.STRUCTURE_TOWER = 'tower';
// @ts-ignore
global.STRUCTURE_TERMINAL = 'terminal';
// @ts-ignore
global.STRUCTURE_LINK = 'link';
// @ts-ignore
global.STRUCTURE_LAB = 'lab';


// --- Global Mocks ---
// @ts-ignore
global.Game = {
    time: 0,
    creeps: {},
};

// @ts-ignore
global.Memory = {};

global.console = {
    ...global.console,
    log: jest.fn(),
};

// --- Helper Functions for Mocks ---

function createMockRoom(
    name: string,
    energyAvailable: number = 0,
    energyCapacityAvailable: number = 300  // Default capacity
): Room {
    const room = {
        name,
        energyAvailable,
        energyCapacityAvailable,
        memory: {} as RoomMemory,
        find: jest.fn().mockReturnValue([]),
    } as unknown as Room;
    return room;
}

function createMockCreep(
    name: string,
    energyCarried: number = 0,
    roomName: string = 'W1N1'
): Creep {
    return {
        name,
        room: { name: roomName } as Room,
        store: {
            energy: energyCarried,
            getUsedCapacity: jest.fn((resourceType?: ResourceConstant) => {
                if (!resourceType || resourceType === RESOURCE_ENERGY) {
                    return energyCarried;
                }
                return 0;
            }),
            getCapacity: jest.fn(() => 50 + energyCarried),
            getFreeCapacity: jest.fn(() => 50),
        } as any as Store<RESOURCE_ENERGY, false>,
        id: name as Id<Creep>,
        spawning: false,
        memory: {} as CreepMemory,
        body: [],
        carryCapacity: 50 + energyCarried,
        fatigue: 0,
        hits: 100,
        hitsMax: 100,
        my: true,
        owner: { username: 'player' },
        ticksToLive: 1500,
        prototype: undefined,
    } as unknown as Creep;
}

function createMockStoreStructure<T extends AnyStoreStructure>(
    id: Id<T>,
    structureType: T['structureType'],
    energyStored: number = 0,
    energyCapacity: number = 200
): T {
    return {
        id,
        structureType,
        store: {
            [RESOURCE_ENERGY]: energyStored,
            getUsedCapacity: jest.fn((resource?: ResourceConstant) => {
                if (!resource || resource === RESOURCE_ENERGY) return energyStored;
                return 0;
            }),
            getCapacity: jest.fn((resource?: ResourceConstant) => {
                 if (!resource || resource === RESOURCE_ENERGY) return energyCapacity;
                 return 0;
            }),
             getFreeCapacity: jest.fn((resource?: ResourceConstant) => {
                 if (!resource || resource === RESOURCE_ENERGY) return energyCapacity - energyStored;
                 return 0;
            })
        } as any,
        pos: new RoomPosition(10, 10 + Math.floor(Math.random()*20), 'W1N1'),
        room: { name: 'W1N1' } as Room,
        prototype: undefined,
    } as unknown as T;
}

function createMockDroppedResource(
    id: Id<Resource>,
    amount: number = 100,
    resourceType: ResourceConstant = RESOURCE_ENERGY
): Resource {
    return {
        id,
        amount,
        resourceType,
        pos: new RoomPosition(20, 20 + Math.floor(Math.random()*20), 'W1N1'),
        room: { name: 'W1N1' } as Room,
        prototype: undefined,
    } as unknown as Resource;
}

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => ({
    x, y, roomName,
    isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number) => {
         if (typeof otherX === 'number' && typeof otherY === 'number') {
            return x === otherX && y === otherY;
        } else if (typeof otherX === 'object' && otherX !== null) {
            return x === otherX.x && y === otherX.y && roomName === otherX.roomName;
        }
        return false;
    }),
     lookFor: jest.fn().mockReturnValue([]),
     getRangeTo: jest.fn(() => 5),
     isNearTo: jest.fn(() => false),
     createConstructionSite: jest.fn(),
     createFlag: jest.fn(),
     findClosestByPath: jest.fn(),
     findClosestByRange: jest.fn(),
     findInRange: jest.fn(),
     getDirectionTo: jest.fn(),
}));


describe('ResourceManager', () => {
    let room: Room;

    beforeEach(() => {
        Game.time = 100;
        Game.creeps = {};
        // This room instance is used by all tests unless a test redefines it locally
        room = createMockRoom('W1N1', 250, 500); // Default energyAvailable=250, energyCapacityAvailable=500
        room.memory = {} as RoomMemory;
        (console.log as jest.Mock).mockClear();
    });

    describe('updateRoomResourceStats', () => {
        test('should initialize memory if not present', () => {
            expect(room.memory.resourceStats).toBeUndefined();
            updateRoomResourceStats(room);
            expect(room.memory.resourceStats).toBeDefined();
            expect(room.memory.resourceStats?.tickLastUpdated).toBe(Game.time);
        });

        test('should correctly sum energy from various sources', () => {
            const structuresWithEnergy: AnyStructure[] = [
                createMockStoreStructure('spawn1' as Id<StructureSpawn>, STRUCTURE_SPAWN, 50, 300),
                createMockStoreStructure('ext1' as Id<StructureExtension>, STRUCTURE_EXTENSION, 50, 50),
                createMockStoreStructure('cont1'as Id<StructureContainer>, STRUCTURE_CONTAINER, 300, 2000),
                createMockStoreStructure('storage1' as Id<StructureStorage>, STRUCTURE_STORAGE, 1000, 1000000),
                createMockStoreStructure('tower1' as Id<StructureTower>, STRUCTURE_TOWER, 800, 1000)
            ];
            const droppedEnergy: Resource[] = [
                createMockDroppedResource('res1' as Id<Resource>, 150),
                createMockDroppedResource('res2' as Id<Resource>, 25),
            ];
            const creepsCarryingEnergy: Creep[] = [
                createMockCreep('creep1', 40, room.name),
                createMockCreep('creep2', 10, room.name),
            ];
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_STRUCTURES) return structuresWithEnergy;
                if (type === FIND_DROPPED_RESOURCES) return droppedEnergy;
                if (type === FIND_MY_CREEPS) return creepsCarryingEnergy;
                return [];
            });
            // Override room's direct energy properties for this specific test
            room.energyAvailable = 100;
            room.energyCapacityAvailable = 350;


            updateRoomResourceStats(room);
            const stats = room.memory.resourceStats!;

            expect(stats.energyInStructures).toBe(50 + 50 + 300 + 1000 + 800); // 2200
            expect(stats.energyInPiles).toBe(150 + 25);     // 175
            expect(stats.energyInTransit).toBe(40 + 10);    // 50
            expect(stats.totalEnergy).toBe(2200 + 175 + 50); // 2425
            expect(stats.energyAvailable).toBe(100); // From room.energyAvailable
            expect(stats.energyCapacityAvailable).toBe(350); // From room.energyCapacityAvailable
            expect(stats.tickLastUpdated).toBe(Game.time);
        });

        test('should handle rooms with no energy sources', () => {
            (room.find as jest.Mock).mockReturnValue([]);
            room.energyAvailable = 0;
            // room.energyCapacityAvailable remains 500 from beforeEach via createMockRoom

            updateRoomResourceStats(room);
            const stats = room.memory.resourceStats!;

            expect(stats.energyInStructures).toBe(0);
            expect(stats.energyInPiles).toBe(0);
            expect(stats.energyInTransit).toBe(0);
            expect(stats.totalEnergy).toBe(0);
            expect(stats.energyAvailable).toBe(0);
            expect(stats.energyCapacityAvailable).toBe(500); // Should reflect the room's actual capacity
            expect(stats.tickLastUpdated).toBe(Game.time);
        });
    });

    describe('getRoomResourceStats', () => {
        test('should call updateRoomResourceStats if memory is undefined', () => {
            getRoomResourceStats(room);
            expect(room.memory.resourceStats).toBeDefined();
            expect(room.memory.resourceStats?.tickLastUpdated).toBe(Game.time);
        });

        test('should call updateRoomResourceStats if stats are stale (old tick)', () => {
            room.memory.resourceStats = {
                energyInStructures: 0, energyInPiles: 0, energyInTransit: 0, totalEnergy: 0,
                energyAvailable: 0, energyCapacityAvailable: 0, // Stale capacity
                tickLastUpdated: Game.time - 1,
            };
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return [createMockDroppedResource('res1' as Id<Resource>, 50)];
                return [];
            });
            // room.energyAvailable is 250, room.energyCapacityAvailable is 500 from main beforeEach

            getRoomResourceStats(room);
            expect(room.memory.resourceStats?.tickLastUpdated).toBe(Game.time);
            expect(room.memory.resourceStats?.energyInPiles).toBe(50);
            expect(room.memory.resourceStats?.energyAvailable).toBe(250);
            expect(room.memory.resourceStats?.energyCapacityAvailable).toBe(500);
        });

        test('should return cached stats and not call update if stats are current', () => {
            const currentStats: RoomResourceStats = {
                energyInStructures: 10, energyInPiles: 20, energyInTransit: 30, totalEnergy: 60,
                energyAvailable: 5, energyCapacityAvailable: 300,
                tickLastUpdated: Game.time,
            };
            room.memory.resourceStats = { ...currentStats };

            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                 if (type === FIND_DROPPED_RESOURCES) return [createMockDroppedResource('res_new' as Id<Resource>, 999)];
                return [];
            });

            const stats = getRoomResourceStats(room);
            expect(stats).toEqual(currentStats);
            expect(stats.energyInPiles).toBe(20);
        });
    });

    describe('logRoomEnergyStats', () => {
        test('should call getRoomResourceStats and log formatted stats', () => {
            const expectedStats: RoomResourceStats = {
                energyInStructures: 100,
                energyInPiles: 50,
                energyInTransit: 20,
                totalEnergy: 170,
                energyAvailable: 150, // This will be taken from room object by getRoomResourceStats if called
                energyCapacityAvailable: 300, // This will be taken from room object
                tickLastUpdated: Game.time,
            };
            // Simulate that getRoomResourceStats will produce these stats
            // by setting the room conditions and then letting getRoomResourceStats calculate them.
            room.energyAvailable = 150;
            room.energyCapacityAvailable = 300;
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_STRUCTURES) return [
                    createMockStoreStructure('s1' as Id<StructureStorage>, STRUCTURE_STORAGE, 100)
                ];
                if (type === FIND_DROPPED_RESOURCES) return [createMockDroppedResource('r1' as Id<Resource>, 50)];
                if (type === FIND_MY_CREEPS) return [createMockCreep('c1', 20)];
                return [];
            });
            // Ensure getRoomResourceStats recalculates
            if(room.memory.resourceStats) room.memory.resourceStats.tickLastUpdated = Game.time -1;


            logRoomEnergyStats(room); // This will call getRoomResourceStats -> updateRoomResourceStats

            const actualLoggedStats = room.memory.resourceStats!;
            expect(console.log).toHaveBeenCalledTimes(1);
            const logCall = (console.log as jest.Mock).mock.calls[0][0];
            expect(logCall).toContain(`[${room.name}] Energy Stats (Tick: ${Game.time})`);
            expect(logCall).toContain(`Spawnable: ${actualLoggedStats.energyAvailable} / ${actualLoggedStats.energyCapacityAvailable}`);
            expect(logCall).toContain(`Stored (Structs): ${actualLoggedStats.energyInStructures}`);
            expect(logCall).toContain(`Dropped (Ground): ${actualLoggedStats.energyInPiles}`);
            expect(logCall).toContain(`Carried (Creeps): ${actualLoggedStats.energyInTransit}`);
            expect(logCall).toContain(`Total Liquid: ${actualLoggedStats.totalEnergy}`);
        });

         test('should update stats via getRoomResourceStats if they are stale before logging', () => {
            room.memory.resourceStats = { // Stale stats
                energyInStructures: 0, energyInPiles: 0, energyInTransit: 0, totalEnergy: 0,
                energyAvailable: 0, energyCapacityAvailable: 300, // Stale capacity
                tickLastUpdated: Game.time - 1,
            };
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return [createMockDroppedResource('r1' as Id<Resource>, 75)];
                return [];
            });
            room.energyAvailable = 50;
            // room.energyCapacityAvailable is 500 from the main beforeEach createMockRoom call.

            logRoomEnergyStats(room);

            expect(console.log).toHaveBeenCalledTimes(1);
            const logCall = (console.log as jest.Mock).mock.calls[0][0];
            expect(logCall).toContain(`Tick: ${Game.time}`);
            expect(logCall).toContain(`Dropped (Ground): 75`);
            expect(logCall).toContain(`Spawnable: 50 / 500`); // Expecting 500 from room object
        });
    });
});

type AnyStoreStructure = StructureSpawn | StructureExtension | StructureContainer | StructureStorage | StructureTower | StructureTerminal | StructureLink | StructureLab;
