import { manageConstruction } from '../../src/managers/constructionManager';
import * as roomManager from '../../src/managers/roomManager';
import * as roadManager from '../../src/managers/roadManager';

// Rely on global types from @types/screeps

// --- Screeps Global Constants & Mocks ---
const EXTENSION_OFFSETS_LENGTH = 8; // Actual length of EXTENSION_OFFSETS in constructionManager

// @ts-ignore
global.OK = 0 as const;
// @ts-ignore
global.ERR_NOT_OWNER = -1 as const;
// @ts-ignore
global.ERR_NO_PATH = -2 as const;
// @ts-ignore
global.ERR_NAME_EXISTS = -3 as const;
// @ts-ignore
global.ERR_BUSY = -4 as const;
// @ts-ignore
global.ERR_NOT_FOUND = -5 as const;
// @ts-ignore
global.ERR_NOT_ENOUGH_ENERGY = -6 as const;
// @ts-ignore
global.ERR_NOT_ENOUGH_RESOURCES = -6 as const; // Alias
// @ts-ignore
global.ERR_INVALID_TARGET = -7 as const;
// @ts-ignore
global.ERR_FULL = -8 as const;
// @ts-ignore
global.ERR_NOT_IN_RANGE = -9 as const;
// @ts-ignore
global.ERR_INVALID_ARGS = -10 as const;
// @ts-ignore
global.ERR_TIRED = -11 as const;
// @ts-ignore
global.ERR_NO_BODYPART = -12 as const;
// @ts-ignore
global.ERR_NOT_ENOUGH_EXTENSIONS = -6 as const; // Alias
// @ts-ignore
global.ERR_RCL_NOT_ENOUGH = -14 as const;
// @ts-ignore
global.ERR_GCL_NOT_ENOUGH = -15 as const;

// @ts-ignore
global.MODE_SIMULATION = 'simulation' as const;
// @ts-ignore
global.MODE_SURVIVAL = 'survival' as const;
// @ts-ignore
global.MODE_WORLD = 'world' as const;
// @ts-ignore
global.MODE_ARENA = 'arena' as const;


// @ts-ignore
global.STRUCTURE_SPAWN = 'spawn' as STRUCTURE_SPAWN;
// @ts-ignore
global.STRUCTURE_EXTENSION = 'extension' as STRUCTURE_EXTENSION;
// @ts-ignore
global.STRUCTURE_ROAD = 'road' as STRUCTURE_ROAD;
// @ts-ignore
global.STRUCTURE_WALL = 'wall' as STRUCTURE_WALL;
// @ts-ignore
global.STRUCTURE_RAMPART = 'rampart' as STRUCTURE_RAMPART;
// @ts-ignore
global.STRUCTURE_KEEPER_LAIR = 'keeperLair' as STRUCTURE_KEEPER_LAIR;
// @ts-ignore
global.STRUCTURE_PORTAL = 'portal' as STRUCTURE_PORTAL;
// @ts-ignore
global.STRUCTURE_CONTROLLER = 'controller' as STRUCTURE_CONTROLLER;
// @ts-ignore
global.STRUCTURE_LINK = 'link' as STRUCTURE_LINK;
// @ts-ignore
global.STRUCTURE_STORAGE = 'storage' as STRUCTURE_STORAGE;
// @ts-ignore
global.STRUCTURE_TOWER = 'tower' as STRUCTURE_TOWER;
// @ts-ignore
global.STRUCTURE_OBSERVER = 'observer' as STRUCTURE_OBSERVER;
// @ts-ignore
global.STRUCTURE_POWER_BANK = 'powerBank' as STRUCTURE_POWER_BANK;
// @ts-ignore
global.STRUCTURE_POWER_SPAWN = 'powerSpawn' as STRUCTURE_POWER_SPAWN;
// @ts-ignore
global.STRUCTURE_EXTRACTOR = 'extractor' as STRUCTURE_EXTRACTOR;
// @ts-ignore
global.STRUCTURE_LAB = 'lab' as STRUCTURE_LAB;
// @ts-ignore
global.STRUCTURE_TERMINAL = 'terminal' as STRUCTURE_TERMINAL;
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container' as STRUCTURE_CONTAINER;
// @ts-ignore
global.STRUCTURE_NUKER = 'nuker' as STRUCTURE_NUKER;
// @ts-ignore
global.STRUCTURE_FACTORY = 'factory' as STRUCTURE_FACTORY;
// @ts-ignore
global.STRUCTURE_INVADER_CORE = 'invaderCore' as STRUCTURE_INVADER_CORE;

// @ts-ignore
global.LOOK_STRUCTURES = 'structure' as LOOK_STRUCTURES;
// @ts-ignore
global.LOOK_CONSTRUCTION_SITES = 'constructionSite' as LOOK_CONSTRUCTION_SITES;
// @ts-ignore
global.LOOK_TERRAIN = 'terrain' as LOOK_TERRAIN;
// @ts-ignore
global.FIND_MY_SPAWNS = 112 as FIND_MY_SPAWNS;
// @ts-ignore
global.FIND_SOURCES = 105 as FIND_SOURCES;
// @ts-ignore
global.FIND_MY_STRUCTURES = 108 as FIND_MY_STRUCTURES;
// @ts-ignore
global.FIND_MY_CONSTRUCTION_SITES = 114 as FIND_MY_CONSTRUCTION_SITES;
// @ts-ignore
global.FIND_STRUCTURES = 107 as FIND_STRUCTURES;


// @ts-ignore
global.TERRAIN_MASK_WALL = 1 as TERRAIN_MASK_WALL;
// @ts-ignore
global.TERRAIN_MASK_SWAMP = 2;
// @ts-ignore
global.TERRAIN_MASK_LAVA = 4;


// @ts-ignore
global.CONTROLLER_STRUCTURES = {
    [STRUCTURE_SPAWN]: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
    [STRUCTURE_EXTENSION]: { 0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
    [STRUCTURE_ROAD]: { 0: 0, 1: 0, 2: 0, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
    [STRUCTURE_WALL]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    [STRUCTURE_RAMPART]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    [STRUCTURE_LINK]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
    [STRUCTURE_STORAGE]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
    [STRUCTURE_TOWER]: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
    [STRUCTURE_OBSERVER]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    [STRUCTURE_POWER_SPAWN]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    [STRUCTURE_EXTRACTOR]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
    [STRUCTURE_LAB]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
    [STRUCTURE_TERMINAL]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
    [STRUCTURE_CONTAINER]: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 },
    [STRUCTURE_NUKER]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
    [STRUCTURE_FACTORY]: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
} as Record<BuildableStructureConstant, Record<number, number>>;


// @ts-ignore
global.Game = {
  time: 0,
  cpu: {
    getUsed: () => 0,
    limit: 20,
    tickLimit: 500,
    bucket: 10000,
    shardLimits: {},
    halt: (): never => { throw new Error('halt called'); },
    setShardLimits: () => OK,
    unlock: () => OK,
    generatePixel: () => OK,
    unlocked: false,
    unlockedTime: 0,
  },
  spawns: {},
  creeps: {},
  rooms: {},
  flags: {},
  constructionSites: {},
  getObjectById: jest.fn(),
};

// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
    const pos = {
        x, y, roomName,
        lookFor: jest.fn().mockImplementation(<T extends LookConstant>(_type: T): any[] => {
            if (_type === LOOK_STRUCTURES) return [] as Structure[];
            if (_type === LOOK_CONSTRUCTION_SITES) return [] as ConstructionSite[];
            if (_type === LOOK_TERRAIN) return ['plain'] as Terrain[];
            return [] as any[];
        }),
        getRangeTo: jest.fn((targetOrX: RoomPosition | {pos: RoomPosition} | number, otherY?: number): number => {
            let targetX: number, targetY: number;
            if (typeof targetOrX === 'number' && typeof otherY === 'number') {
                targetX = targetOrX;
                targetY = otherY;
            } else if (typeof targetOrX === 'object' && targetOrX !== null) {
                const actualTarget = 'pos' in targetOrX ? targetOrX.pos : targetOrX;
                targetX = actualTarget.x;
                targetY = actualTarget.y;
            } else {
                return Infinity;
            }
            return Math.max(Math.abs(x - targetX), Math.abs(y - targetY));
        }),
        isEqualTo: jest.fn((otherX: number | RoomPosition, otherY?: number, otherRoomName?: string) => {
            if (typeof otherX === 'number' && typeof otherY === 'number') {
                return x === otherX && y === otherY && (otherRoomName === undefined || roomName === otherRoomName);
            } else if (typeof otherX === 'object' && otherX !== null) {
                return x === otherX.x && y === otherX.y && roomName === otherX.roomName;
            }
            return false;
        }),
        isNearTo: jest.fn((other: RoomPosition) => Math.abs(x - other.x) <= 1 && Math.abs(y - other.y) <= 1),
        createConstructionSite: jest.fn(),
        createFlag: jest.fn(),
        findClosestByPath: jest.fn(),
        findClosestByRange: jest.fn(),
        findInRange: jest.fn(),
        getDirectionTo: jest.fn(),
    };
    return pos;
});

// @ts-ignore
global.Structure = jest.fn();
// @ts-ignore
global.OwnedStructure = jest.fn();
// @ts-ignore
global.Source = jest.fn();
// @ts-ignore
global.StructureSpawn = jest.fn();
// @ts-ignore
global.StructureController = jest.fn();
// @ts-ignore
global.StructureExtension = jest.fn();
// @ts-ignore
global.StructureContainer = jest.fn();
// @ts-ignore
global.StructureRoad = jest.fn();
// @ts-ignore
global.ConstructionSite = jest.fn();

jest.mock('../../src/managers/roomManager');
jest.mock('../../src/managers/roadManager');

describe('ConstructionManager: manageConstruction', () => {
  let mockRoom: Room;
  let mockGetRoomPhase: jest.SpyInstance;
  let mockPlanAndBuildRoads: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let originalGlobalRoomPosition: any;

  beforeEach(() => {
    Game.time = 0;
    const spawnPos = new RoomPosition(25, 25, 'W1N1');
    // Explicitly make getRangeTo a Jest mock for the spawn's position
    spawnPos.getRangeTo = jest.fn((targetOrX: RoomPosition | {pos: RoomPosition} | number, otherY?: number): number => {
        let targetX: number, targetY: number;
        if (typeof targetOrX === 'number' && typeof otherY === 'number') {
            targetX = targetOrX;
            targetY = otherY;
        } else if (typeof targetOrX === 'object' && targetOrX !== null) {
            const actualTarget = 'pos' in targetOrX ? targetOrX.pos : targetOrX;
            targetX = actualTarget.x;
            targetY = actualTarget.y;
        } else { return Infinity; }
        return Math.max(Math.abs(spawnPos.x - targetX), Math.abs(spawnPos.y - targetY));
    }).mockReturnValue(5); // Default for most tests


    Game.spawns = { 'Spawn1': { id: 'spawn1', name: 'Spawn1', pos: spawnPos, structureType: STRUCTURE_SPAWN } as unknown as StructureSpawn };
    Game.constructionSites = {};

    mockGetRoomPhase = jest.spyOn(roomManager, 'getRoomPhase');
    mockPlanAndBuildRoads = jest.spyOn(roadManager, 'planAndBuildRoads');
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { /* do nothing */ });
    originalGlobalRoomPosition = (global as any).RoomPosition;

    mockRoom = {
      name: 'W1N1',
      controller: { my: true, level: 1, pos: new RoomPosition(5,5,'W1N1'), id: 'ctrl1' } as unknown as StructureController,
      find: jest.fn(),
      createConstructionSite: jest.fn().mockReturnValue(OK),
      memory: { containerPositions: {} },
      getTerrain: jest.fn(() => ({ get: jest.fn(() => 0) })),
      energyAvailable: 300,
      energyCapacityAvailable: 300,
      visual: { text: jest.fn(), line: jest.fn(), circle: jest.fn(), rect: jest.fn() } as any,
      storage: undefined,
      terminal: undefined,
      observer: undefined,
      powerSpawn: undefined,
      extractor: undefined,
      nuker: undefined,
      factory: undefined,
      invaderCore: undefined,
      mode: MODE_WORLD,
      getEventLog: jest.fn(() => []),
      lookAt: jest.fn(()=>[]),
      lookAtArea: jest.fn(()=> [] as any[]),
      lookForAt: jest.fn(() => [] as any[]),
      lookForAtArea: jest.fn(() => ({} as any)),
      findExitTo: jest.fn(()=> 0 as any),
      findPath: jest.fn(()=>[]),
      getPositionAt: jest.fn((x,y) => new RoomPosition(x,y, 'W1N1')),
      createFlag: jest.fn(()=>'flagName' as string | ScreepsReturnCode),
      prototype: undefined as any,
    } as Room;


    (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant, opts?: { filter: any | FilterFunction<FindConstant, any> }) => {
      let results: any[] = [];
      const currentSpawnPos = Game.spawns['Spawn1'].pos;
      const spawnInstance = { id: 'spawn1', pos: currentSpawnPos, structureType: STRUCTURE_SPAWN, room: mockRoom } as unknown as StructureSpawn;
      const source1Instance = { id: 'source1', pos: new RoomPosition(10, 10, 'W1N1'), room: mockRoom } as unknown as Source;
      const source2Instance = { id: 'source2', pos: new RoomPosition(40, 40, 'W1N1'), room: mockRoom } as unknown as Source;

      if (type === FIND_MY_SPAWNS) results = [spawnInstance];
      else if (type === FIND_SOURCES) results = [source1Instance, source2Instance];
      else if (type === FIND_MY_STRUCTURES) results = [];
      else if (type === FIND_MY_CONSTRUCTION_SITES) results = [];
      else if (type === FIND_STRUCTURES) results = [];

      if (opts && opts.filter) {
        const filter = opts.filter;
        if (typeof filter === 'function') {
          results = results.filter(item => filter(item));
        } else if (typeof filter === 'object') {
          results = results.filter(item => Object.keys(filter).every(key => (item as any)[key] === (filter as any)[key]));
        } else {
            results = results.filter(item => (item as any).structureType === filter);
        }
      }
      return results;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global as any).RoomPosition = originalGlobalRoomPosition;
    // No need to restore spawnPos.getRangeTo if clearAllMocks handles it,
    // or set it back to a default in beforeEach if needed.
  });

  test('should not run if Game.time is not a multiple of CONSTRUCTION_INTERVAL (10)', () => {
    Game.time = 5;
    manageConstruction(mockRoom);
    expect(mockGetRoomPhase).not.toHaveBeenCalled();
    expect(mockRoom.createConstructionSite).not.toHaveBeenCalled();
  });

  test('should run if Game.time is a multiple of CONSTRUCTION_INTERVAL (10)', () => {
    Game.time = 10;
    mockGetRoomPhase.mockReturnValue(1);
    manageConstruction(mockRoom);
    expect(mockGetRoomPhase).toHaveBeenCalledWith(mockRoom);
  });

  describe('Phase 2: Initial extensions and containers', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(2);
      mockRoom.controller = { my: true, level: 2, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      Game.time = 10;
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];
        if (findType === FIND_SOURCES) return [{ id: 'source1', pos: new RoomPosition(10, 10, 'W1N1'), room: mockRoom } as unknown as Source];
        let currentResults: any[] = [];
        if (findType === FIND_MY_STRUCTURES) {
            currentResults = [];
        } else if (findType === FIND_MY_CONSTRUCTION_SITES) {
            currentResults = [];
        }
        if (opts && opts.filter && typeof opts.filter === 'function') {
            currentResults = currentResults.filter(opts.filter);
        }
        return currentResults;
      });
    });

    test('should attempt to build extensions and place containers', () => {
      manageConstruction(mockRoom);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), STRUCTURE_EXTENSION);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][2]);

      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), STRUCTURE_CONTAINER);
      const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_CONTAINER).length;
      expect(containerCalls).toBe(1);
      expect(mockRoom.memory.containerPositions!['source1']).toBeDefined();
    });
  });

  describe('Phase 2.5: Road planning', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(2.5);
      Game.time = 20;
    });

    test('should call planAndBuildRoads', () => {
      manageConstruction(mockRoom);
      expect(mockPlanAndBuildRoads).toHaveBeenCalledWith(mockRoom);
    });
  });

  describe('Phase 3: More extensions', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(3);
      mockRoom.controller = { my: true, level: 3, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      Game.time = 30;
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];
        let currentResults: any[] = [];
        if (findType === FIND_MY_STRUCTURES) currentResults = [];
        else if (findType === FIND_MY_CONSTRUCTION_SITES) currentResults = [];

        if (opts && opts.filter && typeof opts.filter === 'function') {
            currentResults = currentResults.filter(opts.filter);
        }
        return currentResults;
      });
    });

    test('should attempt to build extensions', () => {
      manageConstruction(mockRoom);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(Math.min(CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][3], EXTENSION_OFFSETS_LENGTH));
    });
  });


  describe('Phase 3.5: Comprehensive construction', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(3.5);
      mockRoom.controller = { my: true, level: 4, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      Game.time = 40;
        (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant, opts?: { filter: any | FilterFunction<FindConstant, any> }) => {
            let currentResults: any[] = [];
            const spawnInstance = Game.spawns['Spawn1'];
            const source1Instance = { id: 'source1', pos: new RoomPosition(10, 10, 'W1N1'), room: mockRoom } as unknown as Source;
            const source2Instance = { id: 'source2', pos: new RoomPosition(40, 40, 'W1N1'), room: mockRoom } as unknown as Source;

            if (type === FIND_MY_SPAWNS) currentResults = [spawnInstance];
            else if (type === FIND_SOURCES) currentResults = [source1Instance, source2Instance];
            else if (type === FIND_MY_STRUCTURES) currentResults = [];
            else if (type === FIND_MY_CONSTRUCTION_SITES) currentResults = [];
            else if (type === FIND_STRUCTURES) currentResults = [];

            if (opts && opts.filter) {
                const filter = opts.filter;
                if (typeof filter === 'function') {
                currentResults = currentResults.filter(item => filter(item));
                } else if (typeof filter === 'object') {
                currentResults = currentResults.filter(item => Object.keys(filter).every(key => (item as any)[key] === (filter as any)[key]));
                } else {
                    currentResults = currentResults.filter(item => (item as any).structureType === filter);
                }
            }
            return currentResults;
        });
    });

    test('should attempt containers, extensions, and roads', () => {
      manageConstruction(mockRoom);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(Math.min(CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][4], EXTENSION_OFFSETS_LENGTH));

      const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_CONTAINER).length;
      expect(containerCalls).toBe(2);
      expect(mockRoom.memory.containerPositions!['source1']).toBeDefined();
      expect(mockRoom.memory.containerPositions!['source2']).toBeDefined();
      expect(mockPlanAndBuildRoads).toHaveBeenCalledWith(mockRoom);
    });
  });

  describe('buildExtensions function (indirectly tested via manageConstruction)', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(2);
      Game.time = 10;
      mockRoom.controller = { my: true, level: 2, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
    });

    test('should not build if controller is missing or not mine, or level too low', () => {
      (mockRoom.createConstructionSite as jest.Mock).mockClear();
      mockRoom.controller = null as any;
      manageConstruction(mockRoom);
      let extensionSiteCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionSiteCalls).toBe(0);

      (mockRoom.createConstructionSite as jest.Mock).mockClear();
      mockRoom.controller = { my: false, level: 2, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      manageConstruction(mockRoom);
      extensionSiteCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionSiteCalls).toBe(0);

      (mockRoom.createConstructionSite as jest.Mock).mockClear();
      mockRoom.controller = { my: true, level: 1, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      manageConstruction(mockRoom);
      extensionSiteCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionSiteCalls).toBe(0);
    });

    test('should not build if max extensions are already built or queued', () => {
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        let currentItemsToReturn: any[] = [];
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];

        if (findType === FIND_MY_STRUCTURES) {
            currentItemsToReturn = Array(3).fill(null).map((_, i) => ({ structureType: STRUCTURE_EXTENSION, id: `ext${i}`, room: mockRoom, pos: new RoomPosition(1+i,1+i,mockRoom.name) } as unknown as StructureExtension));
        } else if (findType === FIND_MY_CONSTRUCTION_SITES) {
            currentItemsToReturn = Array(2).fill(null).map((_, i) => ({ structureType: STRUCTURE_EXTENSION, id: `cs${i}`, room: mockRoom, pos: new RoomPosition(5+i,5+i,mockRoom.name) } as unknown as ConstructionSite));
        }

        if (opts && opts.filter && typeof opts.filter === 'function') {
            return currentItemsToReturn.filter(opts.filter);
        }
        return currentItemsToReturn;
      });
      manageConstruction(mockRoom);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(0);
    });

    test('should not build if no spawn is found', () => {
      (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant) => {
        if (type === FIND_MY_SPAWNS) return [];
        if (type === FIND_SOURCES) return [];
        return [];
      });
      manageConstruction(mockRoom);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(0);
    });

    test('should correctly place extensions based on offsets and availability', () => {
      const spawnPos = Game.spawns['Spawn1'].pos;
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];
        if (findType === FIND_SOURCES) return [];
        let currentResults: any[] = [];
        if (findType === FIND_MY_STRUCTURES || findType === FIND_MY_CONSTRUCTION_SITES) currentResults = [];
        if (opts && opts.filter && typeof opts.filter === 'function') return currentResults.filter(opts.filter);
        return currentResults;
      });
      (mockRoom.getTerrain().get as jest.Mock).mockReturnValue(0);

      manageConstruction(mockRoom);
      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][2]);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(spawnPos.x + 0, spawnPos.y - 2, STRUCTURE_EXTENSION);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(spawnPos.x + 1, spawnPos.y - 1, STRUCTURE_EXTENSION);
    });

     test('should not place extension on a wall or occupied spot', () => {
      const spawnPos = Game.spawns['Spawn1'].pos;
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];
        if (findType === FIND_SOURCES) return [];
        let currentResults: any[] = [];
        if (findType === FIND_MY_STRUCTURES || findType === FIND_MY_CONSTRUCTION_SITES) currentResults = [];
        if (opts && opts.filter && typeof opts.filter === 'function') return currentResults.filter(opts.filter);
        return currentResults;
      });

      const wallX = spawnPos.x + 0;
      const wallY = spawnPos.y - 2;
      const occupiedX = spawnPos.x + 1;
      const occupiedY = spawnPos.y - 1;

      const originalGetTerrain = mockRoom.getTerrain;
      mockRoom.getTerrain = jest.fn(() => ({
        get: jest.fn((x: number, y: number) => {
            if (x === wallX && y === wallY) return TERRAIN_MASK_WALL;
            return 0;
        })
      })) as any;

      const tempGlobalRoomPosition = (global as any).RoomPosition;
      (global as any).RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
        const posInstance = tempGlobalRoomPosition(x,y,roomName);
        posInstance.lookFor = jest.fn().mockImplementation(<T extends LookConstant>(lookType: T): any[] => {
            if (lookType === LOOK_STRUCTURES) {
                if (x === occupiedX && y === occupiedY) {
                    return [{ structureType: STRUCTURE_ROAD, pos: new RoomPosition(x,y,roomName), room: mockRoom } as unknown as StructureRoad];
                }
            }
            return [] as any[];
        });
        return posInstance;
      });
      (mockRoom.createConstructionSite as jest.Mock).mockClear();
      manageConstruction(mockRoom);

      const extensionCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter((call: any[]) => call[2] === STRUCTURE_EXTENSION).length;
      expect(extensionCalls).toBe(5);

      expect(mockRoom.createConstructionSite).not.toHaveBeenCalledWith(wallX, wallY, STRUCTURE_EXTENSION);
      expect(mockRoom.createConstructionSite).not.toHaveBeenCalledWith(occupiedX, occupiedY, STRUCTURE_EXTENSION);

      (global as any).RoomPosition = tempGlobalRoomPosition;
      mockRoom.getTerrain = originalGetTerrain;
    });
  });

  describe('placeContainersNearSources function (indirectly tested)', () => {
    beforeEach(() => {
      mockGetRoomPhase.mockReturnValue(2);
      Game.time = 10;
      mockRoom.controller = { my: true, level: 2, pos: new RoomPosition(5,5,'W1N1'), id:'ctrl1' } as unknown as StructureController;
      mockRoom.memory.containerPositions = {};
      (mockRoom.find as jest.Mock).mockImplementation((findType: FindConstant, opts?: { filter: any }) => {
        if (findType === FIND_MY_SPAWNS) return [Game.spawns['Spawn1']];
        if (findType === FIND_SOURCES) return [{ id: 'source1', pos: new RoomPosition(10, 10, 'W1N1'), room: mockRoom } as unknown as Source];
        if (findType === FIND_MY_STRUCTURES && opts && opts.filter && ((opts.filter as any).structureType === STRUCTURE_EXTENSION || opts.filter === STRUCTURE_EXTENSION) ) return [];
        if (findType === FIND_MY_CONSTRUCTION_SITES && opts && opts.filter && ((opts.filter as any).structureType === STRUCTURE_EXTENSION || opts.filter === STRUCTURE_EXTENSION) ) return [];
        return [];
      });
      (mockRoom.createConstructionSite as jest.Mock).mockClear();
    });

    test('should not place container if no spawn found', () => {
      (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant) => {
        if (type === FIND_MY_SPAWNS) return [];
        if (type === FIND_SOURCES) return [{ id: 'source1', pos: new RoomPosition(10, 10, 'W1N1'), room: mockRoom } as unknown as Source];
        return [];
      });
      manageConstruction(mockRoom);
      const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_CONTAINER).length;
      expect(containerCalls).toBe(0);
    });

    test('should place a container near a source if none exists', () => {
      (mockRoom.getTerrain().get as jest.Mock).mockReturnValue(0);

      manageConstruction(mockRoom);
      const sourcePos = (mockRoom.find(FIND_SOURCES)[0] as Source).pos;
      const expectedContainerX = sourcePos.x - 1;
      const expectedContainerY = sourcePos.y - 1;
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(expectedContainerX, expectedContainerY, STRUCTURE_CONTAINER);
      expect(mockRoom.memory.containerPositions!['source1']).toEqual({ x: expectedContainerX, y: expectedContainerY });
    });

    test('should not place container if one is already at remembered position (structure)', () => {
      const sourceId = 'source1';
      const memPos = { x: 9, y: 9 };
      mockRoom.memory.containerPositions![sourceId] = memPos;
      const tempGlobalRoomPosition = (global as any).RoomPosition;
      (global as any).RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
        const posInstance = tempGlobalRoomPosition(x,y,roomName);
        posInstance.lookFor = jest.fn().mockImplementation(<T extends LookConstant>(lookType: T): any[] => {
            if (x === memPos.x && y === memPos.y) {
                if (lookType === LOOK_STRUCTURES) return [{ structureType: STRUCTURE_CONTAINER, pos: new RoomPosition(x,y,roomName), room: mockRoom } as unknown as StructureContainer];
            }
            return [] as any[];
        });
        return posInstance;
      });
      manageConstruction(mockRoom);
      const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_CONTAINER).length;
      expect(containerCalls).toBe(0);
      (global as any).RoomPosition = tempGlobalRoomPosition;
    });
     test('should not place container if one is already at remembered position (site)', () => {
      const sourceId = 'source1';
      const memPos = { x: 9, y: 9 };
      mockRoom.memory.containerPositions![sourceId] = memPos;
      const tempGlobalRoomPosition = (global as any).RoomPosition;
      (global as any).RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
        const posInstance = tempGlobalRoomPosition(x,y,roomName);
        posInstance.lookFor = jest.fn().mockImplementation(<T extends LookConstant>(lookType: T): any[] => {
            if (x === memPos.x && y === memPos.y) {
                 if (lookType === LOOK_CONSTRUCTION_SITES) return [{ structureType: STRUCTURE_CONTAINER, pos: new RoomPosition(x,y,roomName), room: mockRoom } as unknown as ConstructionSite];
            }
            return [] as any[];
        });
        return posInstance;
      });
      manageConstruction(mockRoom);
      const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_CONTAINER).length;
      expect(containerCalls).toBe(0);
      (global as any).RoomPosition = tempGlobalRoomPosition;
    });


    test('should clear memory and replan if remembered container is missing', () => {
      const sourceId = 'source1';
      const memPos = { x: 10, y: 9 };
      mockRoom.memory.containerPositions![sourceId] = memPos;
      (mockRoom.getTerrain().get as jest.Mock).mockReturnValue(0);
      Game.time = 20;

      const spawnPos = Game.spawns['Spawn1'].pos;
      const originalSpawnPosGetRangeTo = spawnPos.getRangeTo;
      (spawnPos.getRangeTo as jest.Mock).mockImplementation((targetOrX: RoomPosition | {pos: RoomPosition} | number, otherY?:number ) => {
          let targetX: number, targetY: number;
            if (typeof targetOrX === 'number' && typeof otherY === 'number') {
                targetX = targetOrX;
                targetY = otherY;
            } else if (typeof targetOrX === 'object' && targetOrX !== null) {
                const actualTarget = 'pos' in targetOrX ? targetOrX.pos : targetOrX;
                targetX = actualTarget.x;
                targetY = actualTarget.y;
            } else { return Infinity; }

          if (targetX === 9 && targetY === 9) return 10; // Optimal for (10,10) source
          if (targetX === 10 && targetY === 9) return 15; // memPos (current), less optimal
          if (targetX === 11 && targetY === 11) return 12;
          if (targetX === 11 && targetY === 9) return 16;
          if (targetX === 9 && targetY === 10) return 16;
          if (targetX === 11 && targetY === 10) return 16;
          if (targetX === 9 && targetY === 11) return 16;
          if (targetX === 10 && targetY === 11) return 16;
          return Math.max(Math.abs(spawnPos.x - targetX), Math.abs(spawnPos.y - targetY));
      });

      const tempGlobalRoomPosition = (global as any).RoomPosition;
      (global as any).RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
        const posInstance = tempGlobalRoomPosition(x,y,roomName);
        if (x === memPos.x && y === memPos.y) {
            posInstance.lookFor = jest.fn().mockReturnValue([]);
        } else {
            posInstance.lookFor = jest.fn().mockReturnValue([]);
        }
        // getRangeTo on this posInstance is not used by the code, spawn.pos.getRangeTo is.
        return posInstance;
      });

      manageConstruction(mockRoom);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[${mockRoom.name}] Container for source ${sourceId} at (${memPos.x},${memPos.y}) is missing. Cleared memory, will replan.`);
      const expectedNewPos = { x: 9, y: 9 };
      expect(mockRoom.memory.containerPositions![sourceId]).toEqual(expectedNewPos);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(expectedNewPos.x, expectedNewPos.y, STRUCTURE_CONTAINER);

      spawnPos.getRangeTo = originalSpawnPosGetRangeTo; // Restore
      (global as any).RoomPosition = tempGlobalRoomPosition; // Restore
    });

    test('should not place container if no suitable adjacent spot is found (all walls)', () => {
        const sourcePos = new RoomPosition(10, 10, 'W1N1');
        const originalGetTerrain = mockRoom.getTerrain;
        mockRoom.getTerrain = jest.fn(()=>({
            get: jest.fn((x: number, y: number) => {
                if (Math.abs(x - sourcePos.x) <= 1 && Math.abs(y - sourcePos.y) <= 1 && !(x === sourcePos.x && y === sourcePos.y)) {
                    return TERRAIN_MASK_WALL;
                }
                return 0;
            })
        })) as any;
        Game.time = 50;

        manageConstruction(mockRoom);
        const containerCalls = (mockRoom.createConstructionSite as jest.Mock).mock.calls.filter(call => call[2] === STRUCTURE_CONTAINER).length;
        expect(containerCalls).toBe(0);
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No suitable adjacent spot found for container near source source1'));
        mockRoom.getTerrain = originalGetTerrain;
    });
  });
});

// @ts-ignore
global.PathFinder = {
  search: jest.fn().mockReturnValue({ path: [], incomplete: false, cost: 0, ops: 0 }),
  CostMatrix: jest.fn(),
};

if (typeof console === 'undefined') {
    // @ts-ignore
  global.console = {
    log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(),
  };
}
