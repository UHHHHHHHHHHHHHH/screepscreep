import { handleIdle } from '../../src/managers/idleHelper';
import * as roleDemandManager from '../../src/managers/roleDemandManager';

// --- Enums / Constants ---
enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
}

// @ts-ignore
global.RESOURCE_ENERGY = 'energy';
// @ts-ignore
global.OK = 0;
// @ts-ignore
global.ERR_NOT_IN_RANGE = -9;
// @ts-ignore
global.ERR_NOT_ENOUGH_ENERGY = -6;
// @ts-ignore
global.ERR_FULL = -8;

// @ts-ignore
global.FIND_DROPPED_RESOURCES = 106;
// @ts-ignore
global.FIND_CONSTRUCTION_SITES = 111;
// @ts-ignore
global.FIND_STRUCTURES = 107;
// @ts-ignore
global.STRUCTURE_CONTAINER = 'container';
// @ts-ignore
global.STRUCTURE_STORAGE = 'storage';
// @ts-ignore
global.STRUCTURE_CONTROLLER = 'controller';
// @ts-ignore
global.STRUCTURE_ROAD = 'road';


// --- Global Mocks ---
// @ts-ignore
global.RoomPosition = jest.fn((x: number, y: number, roomName: string) => {
    const pos = {
        x, y, roomName,
        findClosestByPath: jest.fn(),
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
            } else { return Infinity; }
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
        findClosestByRange: jest.fn(),
        findInRange: jest.fn(),
        getDirectionTo: jest.fn(),
    };
    return pos;
});


// @ts-ignore
global.Game = {
    time: 0,
    creeps: {},
    spawns: {},
};

global.console = {
    ...global.console,
    log: jest.fn(),
};

jest.mock('../../src/managers/roleDemandManager');

// Helper to create a mock creep
function createMockCreep(
    name: string,
    memory: Partial<CreepMemory> & { role?: Role | string } = { role: Role.Harvester },
    store: StoreDefinition = { energy: 0 } as any,
    roomName: string = 'W1N1',
    ticksToLive: number = 1500,
    spawning: boolean = false,
): Creep {
    const creepPos = new RoomPosition(10, 10, roomName);

    const creep: Partial<Creep> = {
        name,
        memory: { role: Role.Harvester, ...memory } as CreepMemory,
        spawning,
        store: {
            ...store,
            getCapacity: jest.fn(() => 50),
            getFreeCapacity: jest.fn((resourceType?: ResourceConstant) => {
                if (!resourceType || resourceType === RESOURCE_ENERGY) {
                    const currentEnergy = (store as any)[RESOURCE_ENERGY] || 0;
                    return 50 - currentEnergy;
                }
                return 50;
            }),
            getUsedCapacity: jest.fn((resourceType?: ResourceConstant) => {
                 if (!resourceType || resourceType === RESOURCE_ENERGY) {
                    return (store as any)[RESOURCE_ENERGY] || 0;
                }
                return 0;
            }),
        } as Store<RESOURCE_ENERGY, false>,
        room: {
            name: roomName,
            find: jest.fn().mockReturnValue([]),
            controller: undefined,
            energyAvailable: 300,
            energyCapacityAvailable: 300,
        } as unknown as Room,
        pos: creepPos, // This pos will have findClosestByPath from the global RoomPosition mock
        ticksToLive,
        pickup: jest.fn(),
        withdraw: jest.fn(),
        build: jest.fn(),
        upgradeController: jest.fn(),
        moveTo: jest.fn(),
        say: jest.fn(),
        transfer: jest.fn(),
        id: name as Id<Creep>,
        body: [],
        carryCapacity: 50,
        fatigue: 0,
        hits: 100,
        hitsMax: 100,
        my: true,
        owner: { username: 'player' },
        prototype: undefined,
    };
    return creep as Creep;
}


describe('IdleHelper: handleIdle', () => {
    let mockCreep: Creep;
    let mockRoom: Room;
    let mockController: StructureController;
    let mockIsRoleDemandSatisfied: jest.SpyInstance;

    beforeEach(() => {
        Game.time = 1;
        mockRoom = {
            name: 'W1N1',
            find: jest.fn().mockReturnValue([]),
            controller: undefined,
            energyAvailable: 300,
            energyCapacityAvailable: 300,
        } as unknown as Room;

        mockController = {
            id: 'ctrlId' as Id<StructureController>,
            my: true,
            pos: new RoomPosition(5, 5, mockRoom.name),
            room: mockRoom,
        } as unknown as StructureController;
        mockRoom.controller = mockController;

        mockCreep = createMockCreep('idleCreep', { role: Role.Harvester }, { energy: 0 } as any, mockRoom.name);
        mockCreep.room = mockRoom;

        mockIsRoleDemandSatisfied = jest.spyOn(roleDemandManager, 'isRoleDemandSatisfied');

        jest.clearAllMocks();
        // Clear method mocks on the main mockCreep instance.
        // This is important if mockCreep is modified within tests instead of being recreated.
        const methodsToClear = ['pickup', 'withdraw', 'build', 'upgradeController', 'moveTo', 'say', 'transfer'];
        methodsToClear.forEach(method => {
            if ((mockCreep as any)[method] && typeof (mockCreep as any)[method].mockClear === 'function') {
                (mockCreep as any)[method].mockClear();
            }
        });
        if (mockCreep.pos.findClosestByPath && typeof (mockCreep.pos.findClosestByPath as jest.Mock).mockClear === 'function') {
             (mockCreep.pos.findClosestByPath as jest.Mock).mockClear();
        }
    });

    describe('Picking up Dropped Energy', () => {
        test('should pickup nearby dropped energy if has free capacity', () => {
            mockCreep = createMockCreep('testCreep', { role: Role.Harvester }, { energy: 0 } as any, mockRoom.name);
            mockCreep.room = mockRoom;
            (mockCreep.store.getFreeCapacity as jest.Mock).mockReturnValue(50);
            const droppedPile = { id: 'pile1', resourceType: RESOURCE_ENERGY, amount: 100, pos: new RoomPosition(11, 10, mockRoom.name) };
            (mockCreep.pos.findClosestByPath as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return droppedPile;
                return null;
            });
            (mockCreep.pickup as jest.Mock).mockReturnValue(OK);

            handleIdle(mockCreep);

            expect(mockCreep.pickup).toHaveBeenCalledWith(droppedPile);
            expect(mockCreep.say).toHaveBeenCalledWith("💰");
        });

        test('should move to dropped energy if not in range', () => {
            mockCreep = createMockCreep('testCreep', { role: Role.Harvester }, { energy: 0 } as any, mockRoom.name);
            mockCreep.room = mockRoom;
            (mockCreep.store.getFreeCapacity as jest.Mock).mockReturnValue(50);
            const droppedPile = { id: 'pile1', resourceType: RESOURCE_ENERGY, amount: 100, pos: new RoomPosition(15, 15, mockRoom.name) };
            (mockCreep.pos.findClosestByPath as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return droppedPile;
                return null;
            });
            (mockCreep.pickup as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);

            handleIdle(mockCreep);

            expect(mockCreep.moveTo).toHaveBeenCalledWith(droppedPile, { visualizePathStyle: { stroke: '#ffaa00' }, range: 1 });
            expect(mockCreep.say).toHaveBeenCalledWith("💰");
        });

        test('should not pickup if free capacity is zero', () => {
            mockCreep = createMockCreep('testCreep', { role: Role.Harvester }, { energy: 50 } as any, mockRoom.name); // Full
            mockCreep.room = mockRoom;
            (mockCreep.store.getFreeCapacity as jest.Mock).mockReturnValue(0);
            const droppedPile = { id: 'pile1', resourceType: RESOURCE_ENERGY, amount: 100, pos: new RoomPosition(11, 10, mockRoom.name) };
             (mockCreep.pos.findClosestByPath as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_DROPPED_RESOURCES) return droppedPile;
                return null;
            });
            (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_CONSTRUCTION_SITES) return [{id: 'cs1', pos: new RoomPosition(20,20, mockRoom.name)}];
                return [];
            });

            handleIdle(mockCreep);
            expect(mockCreep.pickup).not.toHaveBeenCalled();
        });
    });

    describe('Building Construction Sites', () => {
        let constructionSite1: ConstructionSite;
        let energyContainer: StructureContainer;

        beforeEach(() => {
            mockCreep = createMockCreep('builderCreep', { role: Role.Builder }, { energy: 0 } as any, mockRoom.name);
            mockCreep.room = mockRoom;

            constructionSite1 = { id: 'cs1', pos: new RoomPosition(20, 20, mockRoom.name), structureType: STRUCTURE_ROAD } as unknown as ConstructionSite;
            energyContainer = {
                id: 'container1' as Id<StructureContainer>,
                structureType: STRUCTURE_CONTAINER,
                store: { [RESOURCE_ENERGY]: 200 } as StoreDefinition,
                pos: new RoomPosition(5,5, mockRoom.name)
            } as unknown as StructureContainer;

            (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant) => {
                if (type === FIND_CONSTRUCTION_SITES) return [constructionSite1];
                if (type === FIND_STRUCTURES) return [energyContainer];
                return [];
            });

            // Specific mock for findClosestByPath for this describe block
            (mockCreep.pos.findClosestByPath as jest.Mock).mockImplementation((targetsOrType: FindConstant | any[], opts?: any) => {
                if (Array.isArray(targetsOrType) && targetsOrType.includes(constructionSite1)) {
                    return constructionSite1;
                }
                if (targetsOrType === FIND_STRUCTURES && opts && opts.filter && opts.filter(energyContainer)) {
                    return energyContainer;
                }
                return null;
            });
        });

        test('should build if has energy and construction sites exist', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            (mockCreep.build as jest.Mock).mockReturnValue(OK);

            handleIdle(mockCreep);

            expect(mockCreep.build).toHaveBeenCalledWith(constructionSite1);
            expect(mockCreep.say).toHaveBeenCalledWith("🔨IdleBuild");
        });

        test('should move to build site if has energy but not in range', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            (mockCreep.build as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);

            handleIdle(mockCreep);

            expect(mockCreep.moveTo).toHaveBeenCalledWith(constructionSite1, { visualizePathStyle: { stroke: '#ffffff' }, range: 3 });
        });

        test('should withdraw from container if needs energy for building', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(0);
            (mockCreep.withdraw as jest.Mock).mockReturnValue(OK);

            handleIdle(mockCreep);

            expect(mockCreep.withdraw).toHaveBeenCalledWith(energyContainer, RESOURCE_ENERGY);
            expect(mockCreep.say).toHaveBeenCalledWith("🔨IdleBuild");
        });
         test('should move to container if needs energy for building and not in range', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(0);
            (mockCreep.withdraw as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);

            handleIdle(mockCreep);

            expect(mockCreep.moveTo).toHaveBeenCalledWith(energyContainer, { visualizePathStyle: { stroke: '#00ff00' }, range: 1 });
        });
    });

    describe('Upgrading Controller', () => {
        let energyContainerFull: StructureContainer;

        beforeEach(() => {
            mockCreep = createMockCreep('upgraderCreep', { role: Role.Upgrader }, { energy: 0 } as any, mockRoom.name);
            mockCreep.room = mockRoom;
            mockRoom.controller = mockController;

            energyContainerFull = {
                id: 'containerFull' as Id<StructureContainer>,
                structureType: STRUCTURE_CONTAINER,
                store: { [RESOURCE_ENERGY]: 500 } as StoreDefinition,
                pos: new RoomPosition(15,15, mockRoom.name)
            } as unknown as StructureContainer;

            (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant, opts?: {filter: any}) => {
                if (type === FIND_CONSTRUCTION_SITES) return [];
                if (type === FIND_STRUCTURES && opts && opts.filter) {
                    if (opts.filter(energyContainerFull)) return [energyContainerFull];
                }
                return [];
            });
            mockIsRoleDemandSatisfied.mockReturnValue(true);
        });

        test('should upgrade controller if has energy, no CS, demands met, enough stored E', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            (mockCreep.upgradeController as jest.Mock).mockReturnValue(OK);

            handleIdle(mockCreep);

            expect(mockCreep.upgradeController).toHaveBeenCalledWith(mockController);
            expect(mockCreep.say).toHaveBeenCalledWith("⬆️IdleUpg");
        });

        test('should move to controller if has energy but not in range for upgrade', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            (mockCreep.upgradeController as jest.Mock).mockReturnValue(ERR_NOT_IN_RANGE);

            handleIdle(mockCreep);

            expect(mockCreep.moveTo).toHaveBeenCalledWith(mockController, { visualizePathStyle: { stroke: '#4CAF50' }, range: 3 });
        });

        test('should withdraw from container if needs energy for upgrading', () => {
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(0);
            (mockCreep.withdraw as jest.Mock).mockReturnValue(OK);

            handleIdle(mockCreep);

            expect(mockCreep.withdraw).toHaveBeenCalledWith(energyContainerFull, RESOURCE_ENERGY);
        });

        test('should not upgrade if role demands not met', () => {
            mockIsRoleDemandSatisfied.mockReturnValue(false);
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            Game.time = 3;

            handleIdle(mockCreep);
            expect(mockCreep.upgradeController).not.toHaveBeenCalled();
            expect(mockCreep.say).toHaveBeenCalledWith("🪑 idle");
        });

        test('should not upgrade if stored energy is too low', () => {
            (mockRoom.find as jest.Mock).mockImplementation((type: FindConstant, opts?: {filter: any}) => {
                if (type === FIND_CONSTRUCTION_SITES) return [];
                if (type === FIND_STRUCTURES && opts && opts.filter) {
                    const emptyContainer = { ...energyContainerFull, store: { [RESOURCE_ENERGY]: 50 }}; // Low energy
                    if(opts.filter(emptyContainer)) return [emptyContainer];
                }
                return [];
            });
            mockRoom.energyAvailable = 50;
            (mockCreep.store.getUsedCapacity as jest.Mock).mockReturnValue(50);
            Game.time = 11;

            handleIdle(mockCreep);
            expect(mockCreep.upgradeController).not.toHaveBeenCalled();
            expect(mockCreep.say).toHaveBeenCalledWith("💰Low E");
        });
    });

    test('should say "🪑 idle" if no other actions are taken', () => {
        mockCreep = createMockCreep('trulyIdle', { role: Role.Harvester }, { energy: 0 } as any, mockRoom.name);
        mockCreep.room = mockRoom;
        mockRoom.controller = mockController; // Ensure controller exists for upgrade check path
        (mockRoom.find as jest.Mock).mockReturnValue([]);
        mockIsRoleDemandSatisfied.mockReturnValue(false);
        Game.time = 3;

        handleIdle(mockCreep);

        expect(mockCreep.pickup).not.toHaveBeenCalled();
        expect(mockCreep.build).not.toHaveBeenCalled();
        expect(mockCreep.withdraw).not.toHaveBeenCalled();
        expect(mockCreep.upgradeController).not.toHaveBeenCalled();
        expect(mockCreep.say).toHaveBeenCalledWith("🪑 idle");
    });
});
