export function getRoomPhase(room: Room): number {
    const level = room.controller?.level ?? 0;
  
    if (level < 2) return 1;
    if (level === 2) return 2;
    if (level === 3) return 3;
    return 4;
}
  