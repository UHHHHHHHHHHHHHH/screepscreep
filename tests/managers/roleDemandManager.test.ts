import {
    determineRoleDemand,
    isRoleDemandSatisfied,
    setRoleDemandOverride,
    clearRoleDemandOverride,
    clearAllDemandOverrides,
} from '../../src/managers/roleDemandManager';

// Mocked dependencies
import * as roomManager from '../../src/managers/roomManager';
import * as creepManager from '../../src/managers/creepManager';
import * as resourceManager from '../../src/managers/resourceManager';
import { RoomResourceStats } from '../../src/managers/resourceManager';

// --- Local Type Definitions for Testing ---
enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}
const allRoles = Object.values(Role) as Role[];

interface RoleDemandEntry {
    count: number;
    priority?: number;
    maxCost?: number;
    isEmergency?: boolean;
}
type RoleDemandMap = Partial<Record<Role, RoleDemandEntry>>;


// --- Constants ---
// @ts-ignore
global.FIND_SOURCES = 105;
// @ts-ignore
global.FIND_CONSTRUCTION_SITES = 111;
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';

// Body Part Constants
// @ts-ignore
global.MOVE = 'move';
// @ts-ignore
global.WORK = 'work';
// @ts-ignore
global.CARRY = 'carry';
// @ts-ignore
global.ATTACK = 'attack';
// @ts-ignore
global.RANGED_ATTACK = 'ranged_attack';
// @ts-ignore
global.HEAL = 'heal';
// @ts-ignore
global.CLAIM = 'claim';
// @ts-ignore
global.TOUGH = 'tough';


// @ts-ignore
global.BODYPART_COST = {
    [MOVE]: 50,
    [WORK]: 100,
    [CARRY]: 50,
    [ATTACK]: 80,
    [RANGED_ATTACK]: 150,
    [HEAL]: 250,
    [CLAIM]: 600,
    [TOUGH]: 10,
} as Record<BodyPartConstant, number>;


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

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => ({
    x, y, roomName,
    lookForAt: jest.fn().mockReturnValue([]),
    isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number, otherRoomName?: string) => {
        if (typeof otherX === 'number' && typeof otherY === 'number') {
            return x === otherX && y === otherY && (otherRoomName === undefined || roomName === otherRoomName);
        } else if (typeof otherX === 'object' && otherX !== null) {
            return x === otherX.x && y === otherX.y && roomName === otherX.roomName;
        }
        return false;
    }),
}));

let mockCostMatrixInstance: CostMatrix;
// @ts-ignore
global.PathFinder = {
    search: jest.fn().mockReturnValue({ path: [], incomplete: false, ops: 0, cost: 0 }),
    CostMatrix: jest.fn().mockImplementation(() => {
        mockCostMatrixInstance = {
            set: jest.fn(), get: jest.fn().mockReturnValue(0), clone: jest.fn(),
            copy: jest.fn(), serialize: jest.fn(), deserialize: jest.fn(),
        } as unknown as CostMatrix;
        return mockCostMatrixInstance;
    }),
};


// --- Mock Implementations for Imported Functions ---
jest.mock('../../src/managers/roomManager');
jest.mock('../../src/managers/creepManager');
jest.mock('../../src/managers/resourceManager');

const mockGetRoomPhase = roomManager.getRoomPhase as jest.Mock;
const mockCountCreepsByRole = creepManager.countCreepsByRole as jest.Mock;
const mockGetRoomResourceStats = resourceManager.getRoomResourceStats as jest.Mock;


// --- Helper Functions ---
function createMockRoom(roomName: string, controllerLevel: number = 1): Room {
    const room = {
        name: roomName,
        memory: {
            containerPositions: {},
            roleDemandOverrides: {},
        } as any,
        find: jest.fn().mockReturnValue([]),
        lookForAt: jest.fn().mockReturnValue([]),
        controller: {
            id: `${roomName}_ctrl` as Id<StructureController>,
            level: controllerLevel,
            pos: new RoomPosition(5, 5, roomName),
            room: undefined as unknown as Room,
        } as StructureController,
        energyAvailable: 300, // Default, can be overridden in tests
        energyCapacityAvailable: 300, // Default
    } as unknown as Room;
    if (room.controller) room.controller.room = room;
    return room;
}

function createMockSource(id: Id<Source>, roomName: string, x: number, y: number): Source {
    return {
        id,
        pos: new RoomPosition(x, y, roomName),
        room: { name: roomName } as Room,
    } as Source;
}

function createMockCreep(name: string, role: Role, sourceId?: Id<Source>, roomName: string = 'W1N1'): Creep {
    return {
        name,
        room: { name: roomName } as Room,
        memory: { role, sourceId, room: roomName } as CreepMemory,
    } as Creep;
}


describe('RoleDemandManager', () => {
    let room: Room;
    let source1: Source;
    let source2: Source;

    beforeEach(() => {
        Game.time = 1;
        Game.creeps = {};
        room = createMockRoom('W1N1', 1);
        source1 = createMockSource('source1' as Id<Source>, room.name, 10, 10);
        source2 = createMockSource('source2' as Id<Source>, room.name, 40, 40);
        (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
            if (type === FIND_SOURCES) return [source1, source2];
            if (type === FIND_CONSTRUCTION_SITES) return [];
            return [];
        });

        mockGetRoomPhase.mockReturnValue(1);
        mockCountCreepsByRole.mockReturnValue(
            allRoles.reduce((acc, role) => { acc[role] = 0; return acc; }, {} as Record<Role, number>)
        );
        mockGetRoomResourceStats.mockReturnValue({
            energyInStructures: 100, energyInPiles: 0, energyInTransit: 0, totalEnergy: 100,
            energyAvailable: 300, // Default energyAvailable
            energyCapacityAvailable: 300, tickLastUpdated: Game.time,
        } as RoomResourceStats);

        (console.log as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('determineRoleDemand', () => {
        test('EMERGENCY: should demand 1 cheap Harvester if no income and low energy', () => {
            mockCountCreepsByRole.mockReturnValue(allRoles.reduce((acc, role) => { acc[role] = 0; return acc; }, {} as Record<Role, number>));
            room.energyAvailable = 100;

            const demand = determineRoleDemand(room);

            expect(demand[Role.Harvester]?.count).toBe(1);
            expect(demand[Role.Harvester]?.isEmergency).toBe(true);
            expect(demand[Role.Harvester]?.maxCost).toBe(300);
            expect(demand[Role.Harvester]?.priority).toBe(0);
            expect(Object.keys(demand).length).toBe(1);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("EMERGENCY: No income, low energy"));
        });

        describe('Phase 1 Demands', () => {
            beforeEach(() => {
                mockGetRoomPhase.mockReturnValue(1);
            });

            test('should demand 2 harvesters per source and 2 upgraders if sources filled', () => {
                room.energyAvailable = 600; // Not critically low, avoid emergency
                Game.creeps = {
                    'h1': createMockCreep('h1', Role.Harvester, source1.id, room.name),
                    'h2': createMockCreep('h2', Role.Harvester, source1.id, room.name),
                    'h3': createMockCreep('h3', Role.Harvester, source2.id, room.name),
                    'h4': createMockCreep('h4', Role.Harvester, source2.id, room.name),
                };
                mockCountCreepsByRole.mockReturnValue({
                    ...allRoles.reduce((acc, role) => { acc[role] = 0; return acc; }, {} as Record<Role, number>),
                    [Role.Harvester]: 4
                });

                const demand = determineRoleDemand(room);
                expect(demand[Role.Harvester]?.count).toBe(4);
                expect(demand[Role.Upgrader]?.count).toBe(2);
            });

            test('should not demand upgraders if sources are not filled and not in emergency', () => {
                room.energyAvailable = 600; // Not critically low, avoid emergency
                mockCountCreepsByRole.mockReturnValue(allRoles.reduce((acc, role) => { acc[role] = 0; return acc; }, {} as Record<Role, number>));
                const demand = determineRoleDemand(room);
                expect(demand[Role.Harvester]?.count).toBe(4); // Still demand harvesters
                expect(demand[Role.Upgrader]).toBeUndefined();
            });
        });

        test('should apply roleDemandOverrides correctly', () => {
            mockGetRoomPhase.mockReturnValue(2.5);
            room.energyAvailable = 600; // Avoid emergency
            // Base demand for phase 2.5 (Miner: 2, Hauler: 2)
            mockCountCreepsByRole.mockReturnValue({ [Role.Miner]:0, [Role.Hauler]:0, [Role.Upgrader]:0, [Role.Builder]:0, [Role.Harvester]:0 });


            room.memory.roleDemandOverrides = {
                [Role.Miner]: 1,    // Override miner from 2 to 1
                [Role.Hauler]: 3,   // Override hauler from 2 to 3
                [Role.Upgrader]: 0, // Override upgrader to 0 (remove demand)
            };
            const demand = determineRoleDemand(room);

            expect(demand[Role.Miner]?.count).toBe(1);
            expect(demand[Role.Hauler]?.count).toBe(3);
            expect(demand[Role.Upgrader]).toBeUndefined();
            // Builder might still be demanded based on phase 2.5 logic if CSites exist
            // If no CSites, builder demand should be undefined or 0 from phase logic.
            // Let's ensure no CSites for this test.
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_SOURCES) return [source1, source2];
                if (type === FIND_CONSTRUCTION_SITES) return []; // No CS
                return [];
            });
            const demandAfterNoCS = determineRoleDemand(room); // Recalculate with no CS
            expect(demandAfterNoCS[Role.Builder]).toBeUndefined();


        });
    });

    describe('isRoleDemandSatisfied', () => {
        test('should return true if all demands are met', () => {
            mockGetRoomPhase.mockReturnValue(1);
            room.energyAvailable = 600; // Avoid emergency
            Game.creeps = {
                'h1': createMockCreep('h1', Role.Harvester, source1.id, room.name),'h2': createMockCreep('h2', Role.Harvester, source1.id, room.name),
                'h3': createMockCreep('h3', Role.Harvester, source2.id, room.name),'h4': createMockCreep('h4', Role.Harvester, source2.id, room.name),
                'u1': createMockCreep('u1', Role.Upgrader, undefined, room.name),'u2': createMockCreep('u2', Role.Upgrader, undefined, room.name),
            };
            mockCountCreepsByRole.mockReturnValue({
                [Role.Harvester]: 4, [Role.Upgrader]: 2,
                [Role.Builder]:0, [Role.Miner]:0, [Role.Hauler]:0
            });

            expect(isRoleDemandSatisfied(room)).toBe(true);
        });

        test('should return false if a demand is not met', () => {
            mockGetRoomPhase.mockReturnValue(1);
            room.energyAvailable = 600; // Avoid emergency
             Game.creeps = {
                'h1': createMockCreep('h1', Role.Harvester, source1.id, room.name),'h2': createMockCreep('h2', Role.Harvester, source1.id, room.name),
                'h3': createMockCreep('h3', Role.Harvester, source2.id, room.name),'h4': createMockCreep('h4', Role.Harvester, source2.id, room.name),
            };
            mockCountCreepsByRole.mockReturnValue({ [Role.Harvester]: 3, [Role.Upgrader]: 2, [Role.Builder]:0, [Role.Miner]:0, [Role.Hauler]:0 });

            expect(isRoleDemandSatisfied(room)).toBe(false);
        });
    });

    describe('Memory Override Functions', () => {
        test('setRoleDemandOverride should update room memory', () => {
            setRoleDemandOverride(room, Role.Miner, 2);
            expect(room.memory.roleDemandOverrides![Role.Miner]).toBe(2);
            expect(console.log).toHaveBeenCalledWith(`[${room.name}] 🔧 Set role demand override: ${Role.Miner} -> 2`);
        });

        test('setRoleDemandOverride with null should clear specific override and object if empty', () => {
            room.memory.roleDemandOverrides = { [Role.Miner]: 2 }; // Only one override
            setRoleDemandOverride(room, Role.Miner, null);
            // Expect the entire roleDemandOverrides object to be deleted
            expect(room.memory.roleDemandOverrides).toBeUndefined();
            expect(console.log).toHaveBeenCalledWith(`[${room.name}] 🗑️ Cleared role demand override for: ${Role.Miner}`);
        });

        test('setRoleDemandOverride with null should clear specific override but keep object if not empty', () => {
            room.memory.roleDemandOverrides = { [Role.Miner]: 2, [Role.Hauler]: 1 };
            setRoleDemandOverride(room, Role.Miner, null);
            expect(room.memory.roleDemandOverrides![Role.Miner]).toBeUndefined();
            expect(room.memory.roleDemandOverrides![Role.Hauler]).toBe(1); // Hauler override should remain
            expect(console.log).toHaveBeenCalledWith(`[${room.name}] 🗑️ Cleared role demand override for: ${Role.Miner}`);
        });

        test('clearRoleDemandOverride should remove the specific role override', () => {
            room.memory.roleDemandOverrides = { [Role.Miner]: 1, [Role.Hauler]: 1 };
            clearRoleDemandOverride(room, Role.Miner);
            expect(room.memory.roleDemandOverrides![Role.Miner]).toBeUndefined();
            expect(room.memory.roleDemandOverrides![Role.Hauler]).toBe(1);
        });

        test('clearAllDemandOverrides should remove the entire override object', () => {
            room.memory.roleDemandOverrides = { [Role.Miner]: 1 };
            clearAllDemandOverrides(room);
            expect(room.memory.roleDemandOverrides).toBeUndefined();
            expect(console.log).toHaveBeenCalledWith(`[${room.name}] 🗑️ Cleared all role demand overrides.`);
        });
    });
});
