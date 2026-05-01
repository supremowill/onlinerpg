import WebSocket from 'ws';
export declare class MatchmakingService {
    private queue;
    private rooms;
    private playerToRoom;
    private checkInterval;
    constructor();
    addToQueue(playerId: string, playerName: string, ws: WebSocket): void;
    removeFromQueue(playerId: string): void;
    onDisconnect(playerId: string): void;
    handleMessage(playerId: string, msg: any): void;
    isPlayerInRoom(playerId: string): boolean;
    private processQueue;
    private createRoom;
    private sendQueueStatus;
    getStats(): {
        queueSize: number;
        activeRooms: number;
        totalPlayers: number;
    };
    destroy(): void;
}
//# sourceMappingURL=MatchmakingService.d.ts.map