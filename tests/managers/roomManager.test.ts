import { getRoomPhase, findFreeSource } from '../../src/managers/roomManager';

enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}

// --- Constants ---
// @ts-ignore
global.FIND_SOURCES = 105;
// @ts-ignore
global.FIND_MY_STRUCTURES = 108;
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.STRUCTURE_EXTENSION = 'extension';
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';

// @ts-ignore
global.CONTROLLER_STRUCTURES = {
    [STRUCTURE_EXTENSION]: {
        0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60,
    },
};

// --- Global Mocks ---
// @ts-ignore
global.Game = {
    time: 0,
    creeps: {},
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

// Local type definition for SpawnRequest
// Based on error: "Type 'SpawnRequest' is missing ... role, body, name, timestamp, cost"
// and function usage: q.memory.role, q.memory.sourceId
interface SpawnRequest {
    name: string;
    body: BodyPartConstant[];
    role: Role; // Top-level role, as indicated by the error message for the function parameter type
    memory: { // Memory structure as used by findFreeSource
        role: Role;
        sourceId?: Id<Source>;
    };
    timestamp: number;
    cost: number;
}


// --- Helper Functions ---
function createMockRoom(
    roomName: string,
    controllerLevel?: number,
    memory: any = {}
): Room {
    const room = {
        name: roomName,
        memory: memory,
        find: jest.fn().mockReturnValue([]),
        lookForAt: jest.fn().mockReturnValue([]),
        controller: controllerLevel !== undefined ? {
            id: `${roomName}_ctrl` as Id<StructureController>,
            level: controllerLevel,
            pos: new RoomPosition(5, 5, roomName),
            room: undefined as unknown as Room,
        } as StructureController : undefined,
    } as unknown as Room;
    if (room.controller) room.controller.room = room;
    return room;
}

function createMockSource(id: Id<Source>, roomName: string, x: number = 10, y: number = 10): Source {
    return {
        id,
        pos: new RoomPosition(x, y, roomName),
        room: { name: roomName } as Room,
    } as Source;
}

function createMockStructure(
    id: Id<AnyStructure>,
    structureType: StructureConstant,
    roomName: string,
    x: number = 15, y: number = 15
): AnyStructure {
    return {
        id,
        structureType,
        pos: new RoomPosition(x, y, roomName),
        room: { name: roomName } as Room,
    } as AnyStructure;
}

function createMockCreep(name: string, role: Role, sourceId?: Id<Source>, roomName: string = 'W1N1'): Creep {
    return {
        name,
        room: { name: roomName } as Room,
        memory: { role, sourceId, room: roomName } as CreepMemory, // Assuming CreepMemory expects 'room'
    } as Creep;
}


describe('RoomManager', () => {
    let room: Room;

    beforeEach(() => {
        Game.time = 1;
        Game.creeps = {};
        room = createMockRoom('W1N1', 1);
        (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: { filter: any }) => {
            if (type === FIND_SOURCES) return [
                createMockSource('s1' as Id<Source>, room.name, 10,10),
                createMockSource('s2' as Id<Source>, room.name, 40,40)
            ];
            if (type === FIND_CONSTRUCTION_SITES) return [];
            if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                return [].filter(opts.filter);
            }
            if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                return [].filter(opts.filter);
            }
            return [];
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getRoomPhase', () => {
        test('should return phase 1 for RCL < 2', () => {
            room = createMockRoom('W1N1', 1);
            expect(getRoomPhase(room)).toBe(1);
            room = createMockRoom('W1N1', 0);
            expect(getRoomPhase(room)).toBe(1);
        });

        test('should return phase 1 if no controller', () => {
            room = createMockRoom('W1N1', undefined);
            expect(getRoomPhase(room)).toBe(1);
        });

        describe('RCL 2 Phase Calculation', () => {
            beforeEach(() => {
                room = createMockRoom('W1N1', 2);
            });

            test('should return phase 2 if extensions < 5 (RCL 2)', () => {
                (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: any) => {
                    if (type === FIND_SOURCES) return [createMockSource('s1'as Id<Source>, room.name)];
                    if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [];
                        return structures.filter(opts.filter);
                    }
                    if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [];
                        return structures.filter(opts.filter);
                    }
                    return [];
                });
                expect(getRoomPhase(room)).toBe(2);

                (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: any) => {
                    if (type === FIND_SOURCES) return [createMockSource('s1'as Id<Source>, room.name)];
                    if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [createMockStructure('e1' as Id<StructureExtension>, STRUCTURE_EXTENSION, room.name)];
                        return structures.filter(opts.filter);
                    }
                    if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [];
                        return structures.filter(opts.filter);
                    }
                    return [];
                });
                expect(getRoomPhase(room)).toBe(2);
            });

            test('should return phase 2 if sources > 0 and containers < sources (RCL 2, extensions >= 5)', () => {
                (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: any) => {
                    if (type === FIND_SOURCES) return [createMockSource('s1'as Id<Source>, room.name), createMockSource('s2'as Id<Source>, room.name)];
                    if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = Array(5).fill(null).map((_,i) => createMockStructure(`e${i}` as Id<StructureExtension>, STRUCTURE_EXTENSION, room.name));
                        return structures.filter(opts.filter);
                    }
                    if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [createMockStructure('c1'as Id<StructureContainer>, STRUCTURE_CONTAINER, room.name)];
                        return structures.filter(opts.filter);
                    }
                    return [];
                });
                expect(getRoomPhase(room)).toBe(2);
            });

            test('should return phase 2.5 if RCL 2, extensions >= 5, and containers >= sources', () => {
                (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: any) => {
                    if (type === FIND_SOURCES) return [createMockSource('s1'as Id<Source>, room.name)];
                    if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                         const structures: AnyStructure[] = Array(5).fill(null).map((_,i) => createMockStructure(`e${i}` as Id<StructureExtension>, STRUCTURE_EXTENSION, room.name));
                        return structures.filter(opts.filter);
                    }
                    if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                         const structures: AnyStructure[] = [createMockStructure('c1'as Id<StructureContainer>, STRUCTURE_CONTAINER, room.name)];
                        return structures.filter(opts.filter);
                    }
                    return [];
                });
                expect(getRoomPhase(room)).toBe(2.5);
            });

             test('should return phase 2.5 if RCL 2, extensions >= 5, and 0 sources', () => {
                (room.find as jest.Mock).mockImplementation((type: FindConstant, opts?: any) => {
                    if (type === FIND_SOURCES) return [];
                    if (type === FIND_MY_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = Array(5).fill(null).map((_,i) => createMockStructure(`e${i}` as Id<StructureExtension>, STRUCTURE_EXTENSION, room.name));
                        return structures.filter(opts.filter);
                    }
                     if (type === FIND_STRUCTURES && opts && typeof opts.filter === 'function') {
                        const structures: AnyStructure[] = [];
                        return structures.filter(opts.filter);
                     }
                    return [];
                });
                expect(getRoomPhase(room)).toBe(2.5);
            });
        });

        test('should return phase 3 for RCL 3', () => {
            room = createMockRoom('W1N1', 3);
            expect(getRoomPhase(room)).toBe(3);
        });

        test('should return phase 3.5 for RCL > 3', () => {
            room = createMockRoom('W1N1', 4);
            expect(getRoomPhase(room)).toBe(3.5);
            room = createMockRoom('W1N1', 8);
            expect(getRoomPhase(room)).toBe(3.5);
        });
    });

    describe('findFreeSource', () => {
        let source1: Source;
        let source2: Source;
        let queuedRequests: SpawnRequest[];

        beforeEach(() => {
            room = createMockRoom('W1N1', 3);
            source1 = createMockSource('s1' as Id<Source>, room.name, 10, 10);
            source2 = createMockSource('s2' as Id<Source>, room.name, 40, 40);
            (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_SOURCES) return [source1, source2];
                return [];
            });
            queuedRequests = [];
            Game.creeps = {};
        });

        test('should return a source if it is free for a Miner', () => {
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBe(source1);
        });

        test('should return null for Miner if all sources have miners', () => {
            Game.creeps['miner1'] = createMockCreep('miner1', Role.Miner, source1.id, room.name);
            Game.creeps['miner2'] = createMockCreep('miner2', Role.Miner, source2.id, room.name);
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBeNull();
        });

        test('should return null for Miner if a source has a harvester', () => {
            Game.creeps['harvester1'] = createMockCreep('harvester1', Role.Harvester, source1.id, room.name);
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBe(source2);
            Game.creeps['harvester2'] = createMockCreep('harvester2', Role.Harvester, source2.id, room.name);
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBeNull();
        });

        test('should return a source if it is free for a Harvester (0 harvesters present)', () => {
            expect(findFreeSource(room, Role.Harvester, queuedRequests)).toBe(source1);
        });

        test('should return null for Harvester if source has a miner', () => {
            Game.creeps['miner1'] = createMockCreep('miner1', Role.Miner, source1.id, room.name);
            expect(findFreeSource(room, Role.Harvester, queuedRequests)).toBe(source2);
            Game.creeps['miner2'] = createMockCreep('miner2', Role.Miner, source2.id, room.name);
            expect(findFreeSource(room, Role.Harvester, queuedRequests)).toBeNull();
        });

        test('should return null for Harvester if source already has 1 harvester', () => {
            Game.creeps['harvester1'] = createMockCreep('harvester1', Role.Harvester, source1.id, room.name);
            expect(findFreeSource(room, Role.Harvester, queuedRequests)).toBe(source2);
             Game.creeps['harvester2'] = createMockCreep('harvester2', Role.Harvester, source2.id, room.name);
            expect(findFreeSource(room, Role.Harvester, queuedRequests)).toBeNull();
        });

        test('should consider queued creeps', () => {
            queuedRequests = [{
                name: 'qminer', body: [], role: Role.Miner,
                memory: { role: Role.Miner, sourceId: source1.id },
                timestamp:0, cost:0
            }];
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBe(source2);

            queuedRequests.push({
                name: 'qharv', body: [], role: Role.Harvester,
                memory: { role: Role.Harvester, sourceId: source2.id },
                timestamp:0, cost:0
            });
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBeNull();
        });

        test('should return null if no sources in room', () => {
            (room.find as jest.Mock).mockReturnValue([]);
            expect(findFreeSource(room, Role.Miner, queuedRequests)).toBeNull();
        });

        test('should return a source for Upgrader even if source has a miner', () => {
            Game.creeps['miner1'] = createMockCreep('miner1', Role.Miner, source1.id, room.name);
            expect(findFreeSource(room, Role.Upgrader, queuedRequests)).toBe(source1);
        });
    });
});
