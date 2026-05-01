import WebSocket from 'ws';
import { GameEngine } from '../game/GameEngine';
import { ClientMessage, ServerMessage } from '../network/Protocol';
export declare class Room {
    id: string;
    players: Map<string, WebSocket>;
    playerNames: Map<string, string>;
    engine: GameEngine;
    private tickInterval;
    private startTime;
    isFinished: boolean;
    constructor();
    addPlayer(playerId: string, name: string, ws: WebSocket): void;
    removePlayer(playerId: string): void;
    start(): void;
    private tick;
    handleMessage(playerId: string, msg: ClientMessage): void;
    private endGame;
    stop(): void;
    broadcast(msg: ServerMessage): void;
    send(ws: WebSocket, msg: ServerMessage): void;
}
//# sourceMappingURL=Room.d.ts.map