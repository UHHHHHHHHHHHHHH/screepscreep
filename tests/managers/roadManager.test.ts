import { planAndBuildRoads } from '../../src/managers/roadManager';

// --- Constants ---
// @ts-ignore
global.STRUCTURE_ROAD = 'road';
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';
// @ts-ignore
global.STRUCTURE_SPAWN = 'spawn';
// @ts-ignore
global.STRUCTURE_CONTROLLER = 'controller';
// @ts-ignore
global.OK = 0;
// @ts-ignore
global.ERR_FULL = -8;
// @ts-ignore
global.ERR_INVALID_TARGET = -10;
// @ts-ignore
global.FIND_MY_SPAWNS = 112;
// @ts-ignore
global.FIND_SOURCES = 105;
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.FIND_CONSTRUCTION_SITES = 111;
// @ts-ignore
global.LOOK_STRUCTURES = 'structure';
// @ts-ignore
global.LOOK_CONSTRUCTION_SITES = 'constructionSite';
// @ts-ignore
global.TERRAIN_MASK_WALL = 1;


// --- Global Mocks ---
// @ts-ignore
global.Game = {
    time: 0,
    rooms: {},
    creeps: {},
};

// @ts-ignore
global.Memory = {};

global.console = {
    ...global.console,
    log: jest.fn(),
};

let mockCostMatrixInstance: CostMatrix;
// @ts-ignore
global.PathFinder = {
    search: jest.fn().mockReturnValue({ path: [], incomplete: false, ops: 0, cost: 0 }),
    CostMatrix: jest.fn().mockImplementation(() => {
        mockCostMatrixInstance = {
            set: jest.fn(),
            get: jest.fn().mockReturnValue(0),
            clone: jest.fn(() => mockCostMatrixInstance),
            copy: jest.fn(),
            serialize: jest.fn(),
            deserialize: jest.fn(),
        } as unknown as CostMatrix;
        return mockCostMatrixInstance;
    }),
};

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
    const pos = {
        x, y, roomName,
        lookFor: jest.fn().mockReturnValue([]),
        isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number, otherRoomName?: string) => {
            if (typeof otherX === 'number' && typeof otherY === 'number') {
                return x === otherX && y === otherY && (otherRoomName === undefined || roomName === otherRoomName);
            } else if (typeof otherX === 'object' && otherX !== null) {
                return x === otherX.x && y === otherX.y && roomName === otherX.roomName;
            }
            return false;
        }),
        getRangeTo: jest.fn(() => 5),
        findClosestByPath: jest.fn(),
        isNearTo: jest.fn(() => false),
        createConstructionSite: jest.fn(),
        createFlag: jest.fn(),
        findClosestByRange: jest.fn(),
        findInRange: jest.fn(),
        getDirectionTo: jest.fn(),
    };
    return pos;
});


// --- Helper Functions ---
const mockTerrainGet = jest.fn();

function createMockRoom(roomName: string): Room {
    mockTerrainGet.mockReturnValue(0);
    const room = {
        name: roomName,
        memory: {
        } as any,
        find: jest.fn().mockReturnValue([]),
        createConstructionSite: jest.fn().mockReturnValue(OK),
        getTerrain: jest.fn().mockReturnValue({ get: mockTerrainGet }),
        controller: {
            id: `${roomName}_ctrl` as Id<StructureController>,
            pos: new RoomPosition(5, 5, roomName),
            room: undefined as unknown as Room,
        } as unknown as StructureController,
    } as unknown as Room;
    if (room.controller) room.controller.room = room;
    return room;
}

function createMockSpawn(id: Id<StructureSpawn>, room: Room, x: number, y: number): StructureSpawn {
    return {
        id,
        pos: new RoomPosition(x, y, room.name),
        room,
        structureType: STRUCTURE_SPAWN,
    } as unknown as StructureSpawn;
}

function createMockSource(id: Id<Source>, room: Room, x: number, y: number): Source {
    return {
        id,
        pos: new RoomPosition(x, y, room.name),
        room,
    } as unknown as Source;
}


describe('RoadManager: planAndBuildRoads', () => {
    let room: Room;
    let spawn: StructureSpawn;
    let controller: StructureController;
    let source1: Source;
    let source2: Source;

    beforeEach(() => {
        Game.time = 1;
        Game.rooms = {};

        room = createMockRoom('W1N1');
        Game.rooms[room.name] = room;

        spawn = createMockSpawn('spawn1' as Id<StructureSpawn>, room, 10, 10);
        controller = room.controller!;
        source1 = createMockSource('source1' as Id<Source>, room, 5, 15);
        source2 = createMockSource('source2' as Id<Source>, room, 15, 5);

        (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
            if (type === FIND_MY_SPAWNS) return [spawn];
            if (type === FIND_SOURCES) return [source1, source2];
            if (type === FIND_STRUCTURES) return [];
            if (type === FIND_CONSTRUCTION_SITES) return [];
            return [];
        });

        (PathFinder.search as jest.Mock).mockClear().mockReturnValue({ path: [], incomplete: false });
        if (mockCostMatrixInstance) {
            (mockCostMatrixInstance.set as jest.Mock).mockClear();
            (mockCostMatrixInstance.get as jest.Mock).mockClear();
        }
        (console.log as jest.Mock).mockClear();
        mockTerrainGet.mockClear().mockReturnValue(0);
    });

    test('should return early if no spawn is found', () => {
        Game.time = 50;
        (room.find as jest.Mock).mockImplementation((type: FindConstant) => {
            if (type === FIND_MY_SPAWNS) return [];
            return [];
        });
        planAndBuildRoads(room);
        expect(PathFinder.search).not.toHaveBeenCalled();
        expect(room.createConstructionSite).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(`[${room.name}] RoadManager: Missing spawn or controller, cannot plan roads.`);
    });

    test('should return early if no controller is found', () => {
        Game.time = 100;
        room.controller = undefined;
        planAndBuildRoads(room);
        expect(PathFinder.search).not.toHaveBeenCalled();
        expect(room.createConstructionSite).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(`[${room.name}] RoadManager: Missing spawn or controller, cannot plan roads.`);
    });

    describe('Planning Stage', () => {
        test('should plan roads if room.memory.roadSitesPlanned is undefined', () => {
            room.memory.roadSitesPlanned = undefined;
            room.memory.containerPositions = {
                [source1.id]: { x: source1.pos.x + 1, y: source1.pos.y },
            };

            const containerPosSource1 = new RoomPosition(source1.pos.x + 1, source1.pos.y, room.name);
            (containerPosSource1.lookFor as jest.Mock).mockImplementation((type: LookConstant) => {
                if (type === LOOK_STRUCTURES) return [{ structureType: STRUCTURE_CONTAINER }];
                return [];
            });

            const originalRP = (global as any).RoomPosition;
            (global as any).RoomPosition = jest.fn((x, y, rn) => {
                if (x === containerPosSource1.x && y === containerPosSource1.y && rn === containerPosSource1.roomName) return containerPosSource1;
                if (spawn && x === spawn.pos.x && y === spawn.pos.y && rn === spawn.pos.roomName) return spawn.pos;
                if (controller && x === controller.pos.x && y === controller.pos.y && rn === controller.pos.roomName) return controller.pos;
                const newPos = originalRP(x,y,rn);
                if (!newPos.lookFor) newPos.lookFor = jest.fn().mockReturnValue([]);
                return newPos;
            });


            const pathSpawnToCtrl = [new RoomPosition(10, 9, room.name), new RoomPosition(10, 8, room.name)];
            const pathContainerToSpawn = [new RoomPosition(7, 15, room.name), new RoomPosition(8, 15, room.name)];
            (PathFinder.search as jest.Mock)
                .mockImplementation((origin, goal) => {
                    if (goal.pos.isEqualTo(spawn.pos)) return { path: pathContainerToSpawn, incomplete: false };
                    if (goal.pos.isEqualTo(controller.pos)) return { path: pathSpawnToCtrl, incomplete: false };
                    return { path: [], incomplete: false };
                });

            planAndBuildRoads(room);

            expect(PathFinder.search).toHaveBeenCalledTimes(2);
            expect(room.memory.roadSitesPlanned).toBeDefined();
            expect(room.memory.roadSitesPlanned).toEqual([
                { x: 7, y: 15 }, { x: 8, y: 15 },
                { x: 10, y: 9 }, { x: 10, y: 8 }
            ]);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Planning initial road network"));
            (global as any).RoomPosition = originalRP;
        });

        test('should skip planning if room.memory.roadSitesPlanned already exists', () => {
            room.memory.roadSitesPlanned = [{ x: 1, y: 1 }];
            planAndBuildRoads(room);
            expect(PathFinder.search).not.toHaveBeenCalled();
            expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("Planning initial road network"));
        });
    });

    describe('Construction Stage', () => {
        beforeEach(() => {
            room.memory.roadSitesPlanned = [
                { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 },
                { x: 14, y: 10 }, { x: 15, y: 10 }, { x: 16, y: 10 }
            ];
        });

        test('should place up to ROAD_CONSTRUCTION_SITES_PER_EXECUTION', () => {
            planAndBuildRoads(room);
            expect(room.createConstructionSite).toHaveBeenCalledTimes(5);
            expect(room.createConstructionSite).toHaveBeenCalledWith(11, 10, STRUCTURE_ROAD);
            expect(room.createConstructionSite).toHaveBeenCalledWith(15, 10, STRUCTURE_ROAD);
        });

        test('should not place on existing roads or road sites', () => {
            const posWithRoad = new RoomPosition(11, 10, room.name);
            (posWithRoad.lookFor as jest.Mock).mockImplementation((type: LookConstant) => {
                if (type === LOOK_STRUCTURES) return [{ structureType: STRUCTURE_ROAD }];
                return [];
            });

            const posWithRoadSite = new RoomPosition(12, 10, room.name);
            (posWithRoadSite.lookFor as jest.Mock).mockImplementation((type: LookConstant) => {
                if (type === LOOK_CONSTRUCTION_SITES) return [{ structureType: STRUCTURE_ROAD }];
                return [];
            });

            const originalRP = (global as any).RoomPosition;
            (global as any).RoomPosition = jest.fn((x,y,rn) => {
                if(x === 11 && y === 10 && rn === room.name) return posWithRoad;
                if(x === 12 && y === 10 && rn === room.name) return posWithRoadSite;
                const defPos = originalRP(x,y,rn);
                if (!defPos.lookFor) defPos.lookFor = jest.fn().mockReturnValue([]);
                return defPos;
            });

            planAndBuildRoads(room);
            expect(room.createConstructionSite).not.toHaveBeenCalledWith(11, 10, STRUCTURE_ROAD);
            expect(room.createConstructionSite).not.toHaveBeenCalledWith(12, 10, STRUCTURE_ROAD);
            expect(room.createConstructionSite).toHaveBeenCalledTimes(4);
            (global as any).RoomPosition = originalRP;
        });

        test('should not place on walls and log warning', () => {
            Game.time = 120;
            mockTerrainGet.mockImplementation((x: number, y: number) => {
                if (x === 11 && y === 10) return TERRAIN_MASK_WALL;
                return 0;
            });
            planAndBuildRoads(room);
            expect(room.createConstructionSite).not.toHaveBeenCalledWith(11, 10, STRUCTURE_ROAD);
            expect(room.createConstructionSite).toHaveBeenCalledTimes(5); // 6 planned - 1 wall = 5 attempts within limit
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Tried to place road on wall at 11,10"));
        });
    });
});
