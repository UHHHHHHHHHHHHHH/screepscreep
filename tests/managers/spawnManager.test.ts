// --- Global Constants FIRST ---
// @ts-ignore
global.OK = 0;
// @ts-ignore
global.ERR_BUSY = -4;
// @ts-ignore
global.ERR_NOT_ENOUGH_ENERGY = -6;
// @ts-ignore
global.ERR_INVALID_ARGS = -10;
// @ts-ignore
global.ERR_NAME_EXISTS = -3;

// @ts-ignore
global.FIND_SOURCES = 105;
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.FIND_MY_SPAWNS = 112;
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';
// @ts-ignore
global.STRUCTURE_SPAWN = 'spawn';
// @ts-ignore
global.STRUCTURE_EXTENSION = 'extension';
// @ts-ignore
global.STRUCTURE_ROAD = 'road';
// @ts-ignore
global.RESOURCE_ENERGY = 'energy';

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


import {
    getAvailableSourceId,
    getAvailableContainerId,
    refreshSpawnQueue,
    manageSpawns
} from '../../src/managers/spawnManager';

// --- Enums, Types, Interfaces ---
enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}
const allRoles = Object.values(Role) as Role[];

interface SpawnRequest {
    role: Role;
    body: BodyPartConstant[];
    name: string;
    memory: CreepMemory;
    timestamp: number;
    cost: number;
}

// --- Global Mocks (after constants, before imports from src/* if they depend on these globals) ---
// @ts-ignore
global.Game = {
    time: 0,
    creeps: {},
    spawns: {},
    getObjectById: jest.fn(),
};

// @ts-ignore
global.Memory = {};

global.console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() };

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => ({
    x, y, roomName,
    isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number, otherRoomName?: string) => {
        if (typeof otherX === 'number' && typeof otherY === 'number') {
            return x === otherX && y === otherY && (otherRoomName === undefined || roomName === otherRoomName);
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


// --- Mocking Imported Modules ---
jest.mock('../../src/types/roles', () => ({
    Role: {
        Harvester: 'harvester', Upgrader: 'upgrader', Builder: 'builder',
        Miner: 'miner', Hauler: 'hauler',
    }
}));
jest.mock('../../src/managers/roleDemandManager');
jest.mock('../../src/roles/roleBodies');
jest.mock('../../src/managers/roomManager');
jest.mock('../../src/managers/creepManager');

import { determineRoleDemand } from '../../src/managers/roleDemandManager';
import { getBodyForRole, getBodySignature, calculateCost } from '../../src/roles/roleBodies';
import { getRoomPhase } from '../../src/managers/roomManager';
import { countCreepsByRole } from '../../src/managers/creepManager';

const mockDetermineRoleDemand = determineRoleDemand as jest.Mock;
const mockGetBodyForRole = getBodyForRole as jest.Mock;
const mockGetBodySignature = getBodySignature as jest.Mock;
const mockCalculateCost = calculateCost as jest.Mock;
const mockGetRoomPhase = getRoomPhase as jest.Mock;
const mockCountCreepsByRole = countCreepsByRole as jest.Mock;


// --- Helper Functions ---
function createMockRoom(roomName: string, energy: number, energyCapacity: number): Room {
    const room = {
        name: roomName,
        energyAvailable: energy,
        energyCapacityAvailable: energyCapacity,
        memory: { spawnQueue: [] } as any,
        find: jest.fn().mockReturnValue([]),
        visual: { text: jest.fn() } as any,
    } as unknown as Room;
    return room;
}

function createMockSpawn(id: string, room: Room, isSpawning: boolean = false, spawningCreepName?: string): StructureSpawn {
    const pos = new RoomPosition(25, 25, room.name);
    const spawningObj: Spawning | null = isSpawning ? {
        name: spawningCreepName || 'spawning_creep',
        needTime: 100,
        remainingTime: 50,
    } as any : null;

    return {
        id: id as Id<StructureSpawn>,
        room,
        spawning: spawningObj,
        spawnCreep: jest.fn(),
        pos,
        name: id,
    } as unknown as StructureSpawn;
}

function createMockSource(id: Id<Source>, roomName: string, x:number = 10, y:number = 10): Source {
    return { id, pos: new RoomPosition(x,y,roomName), room: {name: roomName} as Room } as Source;
}
function createMockContainer(id: Id<StructureContainer>, roomName: string, x:number = 15, y:number = 15): StructureContainer {
    return {
        id, structureType: STRUCTURE_CONTAINER,
        pos: new RoomPosition(x,y,roomName),
        room: {name: roomName} as Room,
        store: { getUsedCapacity: () => 0 }
    } as unknown as StructureContainer;
}

function createMockCreep(name: string, role: Role, roomName: string, sourceId?: Id<Source>, containerId?: Id<StructureContainer>): Creep {
    const memory: CreepMemory = { role };
    if (sourceId) memory.sourceId = sourceId;
    if (containerId) memory.containerId = containerId;

    return {
        name,
        room: { name: roomName } as Room,
        memory,
    } as Creep;
}


describe('SpawnManager', () => {
    let room: Room;
    let spawn1: StructureSpawn;
    let source1: Source;
    let container1: StructureContainer;

    beforeEach(() => {
        Game.time = 1;
        (Memory as any).uuid = 0;
        room = createMockRoom('W1N1', 300, 300);
        spawn1 = createMockSpawn('Spawn1', room);
        Game.spawns = { [spawn1.name]: spawn1 };
        Game.creeps = {};
        room.memory.spawnQueue = [];

        source1 = createMockSource('source1' as Id<Source>, room.name);
        container1 = createMockContainer('container1' as Id<StructureContainer>, room.name);

        mockDetermineRoleDemand.mockReturnValue({});
        mockCountCreepsByRole.mockReturnValue(allRoles.reduce((acc, r) => { acc[r] = 0; return acc; }, {} as Record<Role,number>));
        mockGetRoomPhase.mockReturnValue(2.5);
        mockGetBodyForRole.mockReturnValue([WORK, CARRY, MOVE]);
        mockCalculateCost.mockReturnValue(200);
        mockGetBodySignature.mockReturnValue('WCM');

        (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: {filter: any}) => {
            if (type === FIND_SOURCES) return [source1];
            if (type === FIND_STRUCTURES) {
                if (opts && opts.filter && typeof opts.filter === 'function') {
                    return [container1].filter(opts.filter);
                }
                 return [container1];
            }
            if (type === FIND_MY_SPAWNS) return [spawn1];
            return [];
        });
        jest.clearAllMocks();
    });

    // getAvailableSourceId Tests
    describe('getAvailableSourceId', () => {
        test('should return a source ID if available', () => {
            const sourceId = getAvailableSourceId(room, Role.Miner, 1, []);
            expect(sourceId).toBe(source1.id);
        });
        test('should return null if all sources are occupied by existing creeps', () => {
            Game.creeps['miner1'] = createMockCreep('miner1', Role.Miner, room.name, source1.id);
            const sourceId = getAvailableSourceId(room, Role.Miner, 1, []);
            expect(sourceId).toBeNull();
        });
         test('should return null if all sources are occupied by queued creeps', () => {
            const queue: SpawnRequest[] = [{ name: 'qm1', body: [WORK,MOVE], role: Role.Miner, memory: { role: Role.Miner, sourceId: source1.id }, timestamp: 0, cost: 150}];
            const sourceId = getAvailableSourceId(room, Role.Miner, 1, queue);
            expect(sourceId).toBeNull();
        });
    });

    // getAvailableContainerId Tests
    describe('getAvailableContainerId', () => {
        test('should return a container ID if available', () => {
            const containerId = getAvailableContainerId(room, []);
            expect(containerId).toBe(container1.id);
        });
        test('should return null if all containers are assigned to existing haulers', () => {
            Game.creeps['hauler1'] = createMockCreep('hauler1', Role.Hauler, room.name, undefined, container1.id);
            const containerId = getAvailableContainerId(room, []);
            expect(containerId).toBeNull();
        });
    });

    // refreshSpawnQueue Tests
    describe('refreshSpawnQueue', () => {
        test('should add a request if demand is unmet', () => {
            mockDetermineRoleDemand.mockReturnValue({ [Role.Harvester]: { count: 1, priority: 10 } });
            refreshSpawnQueue(room);
            expect(room.memory.spawnQueue?.length).toBe(1);
            expect(room.memory.spawnQueue![0].role).toBe(Role.Harvester);
        });

        test('should add emergency harvester to front of queue', () => {
            const preExistingRequest: SpawnRequest = { name: 'n1', body: [WORK,MOVE], role: Role.Miner, memory: {role: Role.Miner}, timestamp:0, cost:150};
            room.memory.spawnQueue = [preExistingRequest];
            mockDetermineRoleDemand.mockReturnValue({ [Role.Harvester]: { count: 1, isEmergency: true, priority: 0, maxCost: 300 } });
            mockGetBodyForRole.mockReturnValue([WORK,CARRY,MOVE]);
            mockCalculateCost.mockReturnValue(200);

            refreshSpawnQueue(room);
            expect(room.memory.spawnQueue?.length).toBe(1);
            expect(room.memory.spawnQueue![0].role).toBe(Role.Harvester);
            expect(room.memory.spawnQueue![0].name).toContain("_EM_");
        });

        test('should filter out requests no longer in demand', () => {
            const initialRequest: SpawnRequest = { name: 'h1', body: [WORK,CARRY,MOVE], role: Role.Harvester, memory: {role:Role.Harvester}, timestamp:0, cost:200 };
            room.memory.spawnQueue = [initialRequest];
            mockDetermineRoleDemand.mockReturnValue({ [Role.Harvester]: { count: 0 } });
            refreshSpawnQueue(room);
            expect(room.memory.spawnQueue?.length).toBe(0);
        });
    });

    // manageSpawns Tests
    describe('manageSpawns', () => {
        beforeEach(() => {
            Game.spawns = { [spawn1.name]: spawn1 };
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_MY_SPAWNS) return [spawn1];
                if (type === FIND_SOURCES) return [source1];
                if (type === FIND_STRUCTURES) {
                     return [container1].filter(s => s.structureType === STRUCTURE_CONTAINER);
                }
                return [];
            });
        });

        test('should do nothing if spawn is busy', () => {
            spawn1 = createMockSpawn('Spawn1', room, true, 'busy_creep');
            Game.spawns = { [spawn1.name]: spawn1 };
            Game.creeps['busy_creep'] = createMockCreep('busy_creep', Role.Harvester, room.name);

            manageSpawns(spawn1);
            expect(spawn1.spawnCreep).not.toHaveBeenCalled();
            expect(room.visual.text).toHaveBeenCalled();
        });

        test('should do nothing if queue is empty after refresh', () => {
            room.memory.spawnQueue = [];
            mockDetermineRoleDemand.mockReturnValue({});
            Game.time = 1; // Ensure refreshQueue is called (1 % 3 === 1)

            manageSpawns(spawn1);
            expect(spawn1.spawnCreep).not.toHaveBeenCalled();
        });

        test('should not spawn if not enough energy', () => {
            const request: SpawnRequest = { name: 'c1', role: Role.Harvester, body: [WORK,CARRY,MOVE], memory: {role: Role.Harvester}, cost: 200, timestamp:0 };
            room.memory.spawnQueue = [request];
            room.energyAvailable = 100;
            Game.time = 2;

            manageSpawns(spawn1);
            expect(spawn1.spawnCreep).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Waiting for energy"));
        });

        test('should spawn creep if queue has request and energy is available', () => {
            const request: SpawnRequest = { name: 'harv1', role: Role.Harvester, body: [WORK,CARRY,MOVE], memory: {role: Role.Harvester}, cost: 200, timestamp:0 };
            room.memory.spawnQueue = [request];
            Game.time = 2; // Avoid refreshQueue

            room.energyAvailable = 300;
            (spawn1.spawnCreep as jest.Mock).mockReturnValue(OK);

            manageSpawns(spawn1);

            expect(spawn1.spawnCreep).toHaveBeenCalledWith(request.body, request.name, { memory: request.memory });
            expect(room.memory.spawnQueue?.length).toBe(0);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("✅ Spawning harvester: harv1")); // Corrected case
        });

        test('should remove problematic request if spawnCreep returns ERR_INVALID_ARGS', () => {
            const request: SpawnRequest = { name: 'bad_harv', role: Role.Harvester, body: [], memory: {role: Role.Harvester}, cost: 0, timestamp:0 };
            room.memory.spawnQueue = [request];
            Game.time = 2; // Avoid refreshQueue

            room.energyAvailable = 300;
            (spawn1.spawnCreep as jest.Mock).mockReturnValue(ERR_INVALID_ARGS);

            manageSpawns(spawn1);
            expect(room.memory.spawnQueue?.length).toBe(0);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("❌ Failed to spawn bad_harv"));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Removing problematic spawn request: bad_harv"));
        });
    });
});
