import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, WebSocket } from "ws";
import { LlmService } from "../services/ai-llm.service";

/**
 * WebSocket Gateway for AI Assistant.
 * Handles WebSocket connections, disconnections, and incoming messages
 * for the AI LLM service.
 */

@WebSocketGateway({ path: "/ai-llm" , cors: true})
export class LlmGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {

  @WebSocketServer()
  private server: Server;

  constructor(private readonly llmService: LlmService) {}

  afterInit(server: Server) {
    console.log("WebSocket server initialized");
  }

  async handleConnection(client: WebSocket) {
    console.log("Client connected");
  
    client.on("close", () => {
      console.log("Client disconnected");
    });
  
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: "connected", message: "Welcome to AI LLM" }));
      this.llmService.aiLlmService(client);
    }
  }

  async handleDisconnect(client: WebSocket) {
    console.log("Client disconnected");
  }
}