import { BaseRole } from '../../src/roles/base';
import { findFreeSource } from '../../src/managers/roomManager'; // Mocked
import { Role } from '../../src/types/roles';

// --- Concrete Test Class ---
class TestRole extends BaseRole {
    public run(creep: Creep): void {}
    public testCollectEnergy(creep: Creep): void { super.collectEnergy(creep); }
    public testUpdateWorkingState(creep: Creep): void { super.updateWorkingState(creep); }
    public testDeliverEnergy(creep: Creep): void { super.deliverEnergy(creep); }
    public testAssignSource(creep: Creep): Id<Source> | void { return super.assignSource(creep); }
}

// --- Global Constants ---
// @ts-ignore
global.RESOURCE_ENERGY = 'energy';
// @ts-ignore
global.OK = 0;
// @ts-ignore
global.ERR_NOT_IN_RANGE = -9;
// @ts-ignore
global.ERR_NOT_ENOUGH_RESOURCES = -6;
// @ts-ignore
global.ERR_FULL = -8;
// @ts-ignore
global.FIND_DROPPED_RESOURCES = 106;
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.FIND_SOURCES_ACTIVE = 104;
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';
// @ts-ignore
global.STRUCTURE_STORAGE = 'storage';
// @ts-ignore
global.STRUCTURE_SPAWN = 'spawn';
// @ts-ignore
global.STRUCTURE_EXTENSION = 'extension';
// @ts-ignore
global.STRUCTURE_TOWER = 'tower';

// Body Part Constants
// @ts-ignore
global.MOVE = 'move' as MovePart;
// @ts-ignore
global.WORK = 'work' as WorkPart;
// @ts-ignore
global.CARRY = 'carry' as CarryPart;
// @ts-ignore
global.ATTACK = 'attack' as AttackPart;
// @ts-ignore
global.RANGED_ATTACK = 'ranged_attack' as RangedAttackPart;
// @ts-ignore
global.HEAL = 'heal' as HealPart;
// @ts-ignore
global.CLAIM = 'claim' as ClaimPart;
// @ts-ignore
global.TOUGH = 'tough' as ToughPart;

// @ts-ignore
global.BODYPART_COST = {
    [MOVE]: 50, [WORK]: 100, [CARRY]: 50, [ATTACK]: 80, [RANGED_ATTACK]: 150,
    [HEAL]: 250, [CLAIM]: 600, [TOUGH]: 10,
} as Record<BodyPartConstant, number>;


// --- Global Mocks ---
// @ts-ignore
global.Game = {
    time: 0,
    creeps: {},
};

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
    const pos = {
        x, y, roomName,
        findClosestByPath: jest.fn(),
        getRangeTo: jest.fn().mockReturnValue(5),
        isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number, otherRoomName?: string) => {
            if (typeof otherX === 'number' && typeof otherY === 'number') {
                return x === otherX && y === otherY && (otherRoomName === undefined || roomName === otherRoomName);
            } else if (typeof otherX === 'object' && otherX !== null) {
                return x === otherX.x && y === otherX.y && roomName === otherX.roomName;
            }
            return false;
        }),
        lookFor: jest.fn().mockReturnValue([]),
        isNearTo: jest.fn(() => false),
    };
    return pos;
});

// Mock console fully
// @ts-ignore
global.console = {
    log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
    dir: jest.fn(), table: jest.fn(), trace: jest.fn(), assert: jest.fn(),
    count: jest.fn(), countReset: jest.fn(), group: jest.fn(), groupCollapsed: jest.fn(),
    groupEnd: jest.fn(), time: jest.fn(), timeEnd: jest.fn(), timeLog: jest.fn(),
    timeStamp: jest.fn(), profile: jest.fn(), profileEnd: jest.fn(), clear: jest.fn(),
} as unknown as Console;


// --- Mocking Imported Modules ---
jest.mock('../../src/managers/roomManager', () => ({
    findFreeSource: jest.fn(),
}));

const mockFindFreeSource = findFreeSource as jest.Mock;

// Rely on global CreepMemory and SpawnRequest types
interface CreepMemory {
    role: Role;
    atCapacity?: boolean;
    sourceId?: Id<Source>;
    [key: string]: any;
}
interface SpawnRequest {
    name: string;
    role: Role;
    body: BodyPartConstant[];
    memory: CreepMemory;
    timestamp: number;
    cost: number;
}


// --- Helper to Create Mock Creep ---
function createMockCreep(
    name: string,
    memory: CreepMemory,
    energy: number = 0,
    capacity: number = 50,
    roomName: string = 'W1N1',
    spawning: boolean = false
): Creep {
    const creepRoom = {
        name: roomName,
        find: jest.fn().mockReturnValue([]),
        memory: { spawnQueue: [] } as any,
        energyAvailable: 300,
        energyCapacityAvailable: 300,
    } as unknown as Room;

    const store: Store<RESOURCE_ENERGY, false> = {
        energy: energy,
        getUsedCapacity: jest.fn((resource?: ResourceConstant) => resource === RESOURCE_ENERGY ? energy : 0),
        getFreeCapacity: jest.fn((resource?: ResourceConstant) => resource === RESOURCE_ENERGY ? capacity - energy : 0),
        getCapacity: jest.fn((resource?: ResourceConstant) => resource === RESOURCE_ENERGY ? capacity : 0),
    } as any;


    const creep = {
        name,
        memory,
        room: creepRoom,
        pos: new RoomPosition(10, 10, roomName),
        store,
        spawning,
        say: jest.fn(),
        carry: store,
        carryCapacity: capacity,
        pickup: jest.fn(),
        withdraw: jest.fn(),
        harvest: jest.fn(),
        transfer: jest.fn(),
        moveTo: jest.fn(),
        id: name as Id<Creep>,
        body: [],
        fatigue: 0,
        hits: 100,
        hitsMax: 100,
        my: true,
        owner: { username: 'player' },
        ticksToLive: 1500,
        prototype: undefined,
    } as unknown as Creep;
    return creep as Creep;
}

// Helper for mock structures with store
type AnyStoreStructure = StructureSpawn | StructureExtension | StructureContainer | StructureStorage | StructureTower | StructureTerminal | StructureLink | StructureLab;

function createMockStoreStructure<T extends AnyStoreStructure>(
    id: string,
    type: T['structureType'],
    energyStored: number,
    energyCapacity: number,
    roomName: string = 'W1N1'
) {
    return {
        id: id as Id<T>,
        structureType: type,
        store: {
            [RESOURCE_ENERGY]: energyStored,
            getUsedCapacity: jest.fn((res?: ResourceConstant) => res === RESOURCE_ENERGY ? energyStored : 0),
            getFreeCapacity: jest.fn((res?: ResourceConstant) => res === RESOURCE_ENERGY ? energyCapacity - energyStored : 0),
            getCapacity: jest.fn((res?: ResourceConstant) => res === RESOURCE_ENERGY ? energyCapacity : 0),
        } as any,
        pos: new RoomPosition(Math.floor(Math.random()*40)+5, Math.floor(Math.random()*40)+5, roomName),
        room: { name: roomName } as Room,
        prototype: undefined,
    } as unknown as T;
}

function createMockSource(id: Id<Source>, roomName: string, x: number = 10, y: number = 10): Source {
    return {
        id,
        pos: new RoomPosition(x, y, roomName),
        room: { name: roomName } as Room,
    } as Source;
}


describe('BaseRole', () => {
    let testRole: TestRole;
    let creep: Creep;

    beforeEach(() => {
        testRole = new TestRole();
        const initialMemory: CreepMemory = { role: Role.Harvester, atCapacity: false };
        creep = createMockCreep('baseCreep', initialMemory, 0, 50, 'W1N1');
        Game.time = 1;
        const methods = ['pickup', 'withdraw', 'harvest', 'transfer', 'moveTo', 'say'];
        methods.forEach(m => ((creep as any)[m] as jest.Mock).mockClear());
        if (creep.pos.findClosestByPath) (creep.pos.findClosestByPath as jest.Mock).mockReset().mockReturnValue(null);
        if (creep.pos.getRangeTo) (creep.pos.getRangeTo as jest.Mock).mockClear().mockReturnValue(5);

        (console.log as jest.Mock).mockClear();
        mockFindFreeSource.mockClear();
    });

    describe('collectEnergy', () => {
        test('should pickup dropped energy if available and significant', () => {
            const droppedPile = { id: 'pile1', resourceType: RESOURCE_ENERGY, amount: 50, pos: new RoomPosition(11,10, creep.room.name) };
            (creep.pos.findClosestByPath as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return droppedPile;
                return null;
            });
            (creep.pickup as jest.Mock).mockReturnValue(OK);
            testRole.testCollectEnergy(creep);
            expect(creep.pickup).toHaveBeenCalledWith(droppedPile);
        });

        test('should move to dropped energy if not in range', () => {
            const droppedPile = { id: 'pile1', resourceType: RESOURCE_ENERGY, amount: 50, pos: new RoomPosition(15,15, creep.room.name) };
            (creep.pos.findClosestByPath as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return droppedPile;
                return null;
            });
            (creep.pickup as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);
            testRole.testCollectEnergy(creep);
            expect(creep.moveTo).toHaveBeenCalledWith(droppedPile, expect.anything());
        });

        test('should withdraw from preferred storage (container) if no dropped energy', () => {
            (creep.pos.findClosestByPath as jest.Mock).mockReturnValue(null);
            const container = createMockStoreStructure('cont1', STRUCTURE_CONTAINER, 200, 2000, creep.room.name);
            (creep.room.find as jest.Mock).mockReturnValue([container]);
            (creep.withdraw as jest.Mock).mockReturnValue(OK);
            testRole.testCollectEnergy(creep);
            expect(creep.withdraw).toHaveBeenCalledWith(container, RESOURCE_ENERGY);
        });

        test('should withdraw from spawn/extension if queue empty and no preferred storage', () => {
            const spawnToWithdraw = createMockStoreStructure('spawn1', STRUCTURE_SPAWN, 100, 300, creep.room.name);

            (creep.pos.findClosestByPath as jest.Mock)
                .mockImplementationOnce((type: FindConstant) => {
                    expect(type).toBe(FIND_DROPPED_RESOURCES);
                    return null;
                })
                .mockImplementationOnce((targets: AnyStructure[]) => {
                    if (Array.isArray(targets) && targets.includes(spawnToWithdraw)) {
                        return spawnToWithdraw;
                    }
                    return null;
                });

            let findCallCount = 0;
            (creep.room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                findCallCount++;
                if (type === FIND_STRUCTURES) {
                    if (findCallCount === 1) return [];
                    return [spawnToWithdraw];
                }
                return [];
            });

            creep.room.memory.spawnQueue = [];
            (creep.withdraw as jest.Mock).mockReturnValue(OK);

            testRole.testCollectEnergy(creep);
            expect(creep.withdraw).toHaveBeenCalledWith(spawnToWithdraw, RESOURCE_ENERGY);
        });


        test('should NOT withdraw from spawn/extension if queue NOT empty', () => {
            (creep.pos.findClosestByPath as jest.Mock).mockReturnValue(null);
            (creep.room.find as jest.Mock).mockReturnValue([]);
            const spawnRequest: SpawnRequest = {
                name: 'testCreep',
                role: Role.Harvester,
                body: [WORK, CARRY, MOVE] as BodyPartConstant[],
                memory: { role: Role.Harvester } as CreepMemory,
                timestamp: Game.time,
                cost: 200,
            };
            creep.room.memory.spawnQueue = [spawnRequest];

            testRole.testCollectEnergy(creep);
            expect(creep.withdraw).not.toHaveBeenCalled();
        });

        test('should harvest from source as last resort if active sources exist', () => {
            const activeSource = createMockSource('source1' as Id<Source>, creep.room.name, 5, 5);

            (creep.pos.findClosestByPath as jest.Mock)
                .mockImplementationOnce((type: FindConstant) => { // For FIND_DROPPED_RESOURCES
                    return null;
                })
                // If preferredStorageTargets and spawnExtensionTargets are empty (due to room.find returning []),
                // findClosestByPath won't be called for them with an array.
                // The next call to findClosestByPath will be with activeSources (an array of Source objects).
                .mockImplementationOnce((targets: Source[]) => {
                    if (Array.isArray(targets) && targets.some(s => s.id === activeSource.id)) {
                        return activeSource;
                    }
                    return null;
                });

            (creep.room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_STRUCTURES) return []; // No storage/spawn/ext for this test path
                if (type === FIND_SOURCES_ACTIVE) return [activeSource];
                return [];
            });

            (creep.harvest as jest.Mock).mockReturnValue(OK);
            testRole.testCollectEnergy(creep);
            expect(creep.harvest).toHaveBeenCalledWith(activeSource);
        });
    });

    describe('updateWorkingState', () => {
        test('should set atCapacity to false if full and now empty', () => {
            creep.memory.atCapacity = true;
            (creep.store.getUsedCapacity as jest.Mock).mockReturnValue(0);
            testRole.testUpdateWorkingState(creep);
            expect(creep.memory.atCapacity).toBe(false);
        });

        test('should set atCapacity to true if not full and now full', () => {
            creep.memory.atCapacity = false;
            (creep.store.getFreeCapacity as jest.Mock).mockReturnValue(0);
            testRole.testUpdateWorkingState(creep);
            expect(creep.memory.atCapacity).toBe(true);
        });
    });

    describe('deliverEnergy', () => {
        test('should transfer to spawn/extension if available', () => {
            const spawn = createMockStoreStructure('spawn1', STRUCTURE_SPAWN, 0, 300, creep.room.name);
            (creep.room.find as jest.Mock).mockReturnValue([spawn]);
            (creep.transfer as jest.Mock).mockReturnValue(OK);
            testRole.testDeliverEnergy(creep);
            expect(creep.transfer).toHaveBeenCalledWith(spawn, RESOURCE_ENERGY);
        });

        test('should prioritize less full towers, then spawns/extensions', () => {
            const tower1 = createMockStoreStructure('t1', STRUCTURE_TOWER, 100, 1000, creep.room.name);
            const tower2 = createMockStoreStructure('t2', STRUCTURE_TOWER, 500, 1000, creep.room.name);
            const spawn = createMockStoreStructure('s1', STRUCTURE_SPAWN, 0, 300, creep.room.name);
            (creep.room.find as jest.Mock).mockReturnValue([spawn, tower2, tower1]);

            testRole.testDeliverEnergy(creep);
            expect(creep.transfer).toHaveBeenCalledWith(tower1, RESOURCE_ENERGY);
        });

        test('should move to target if not in range for delivery', () => {
            const spawn = createMockStoreStructure('spawn1', STRUCTURE_SPAWN, 0, 300, creep.room.name);
            (creep.room.find as jest.Mock).mockReturnValue([spawn]);
            (creep.transfer as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);
            testRole.testDeliverEnergy(creep);
            expect(creep.moveTo).toHaveBeenCalledWith(spawn, expect.anything());
        });
    });

    describe('assignSource', () => {
        test('should return existing sourceId from memory', () => {
            creep.memory.sourceId = 'sourceMemId' as Id<Source>;
            expect(testRole.testAssignSource(creep)).toBe('sourceMemId');
            expect(mockFindFreeSource).not.toHaveBeenCalled();
        });

        test('should call findFreeSource if no sourceId in memory', () => {
            delete creep.memory.sourceId;
            const freeSource = { id: 'freeSourceId' } as Source;
            mockFindFreeSource.mockReturnValue(freeSource);

            expect(testRole.testAssignSource(creep)).toBe(freeSource.id);
            expect(mockFindFreeSource).toHaveBeenCalledWith(creep.room, creep.memory.role);
            expect(creep.memory.sourceId).toBe(freeSource.id);
        });

        test('should say "no src" if findFreeSource returns null', () => {
             delete creep.memory.sourceId;
            mockFindFreeSource.mockReturnValue(null);
            testRole.testAssignSource(creep);
            expect(creep.say).toHaveBeenCalledWith("no src");
        });
    });
});
