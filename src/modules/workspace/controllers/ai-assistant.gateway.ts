import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server as WebSocketServerType, WebSocket } from 'ws';
import { AiAssistantService } from '../services/ai-assistant.service';
import { LlmService } from "../services/ai-llm.service";

@WebSocketGateway({ path: '/ai-assistant', cors: true })
export class AiAssistantGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  private server: WebSocketServerType;

  constructor(
    private readonly aiAssistantService: AiAssistantService,
    private readonly llmService: LlmService,
  ) {}

  afterInit(server: WebSocketServerType) {
    console.log('WebSocket server initialized');

    // Listen to connection at raw level to attach headers
    server.on('connection', (socket: WebSocket, req: any) => {
      (socket as any)['headers'] = req.headers;
    });
  }

  async handleConnection(client: any) {
    const headers = client.headers || {};
    const mode = headers['mode'];

    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event: 'connected',
          message: 'Welcome to AI Assistant!',
        }),
      );

      // Call appropriate service based on the "mode" header
      if (mode === 'sparrow-ai') {
        this.aiAssistantService.generateTextChatBot(client);
      } else if (mode === 'llm-evaluation') {
        this.llmService.aiLlmService(client);
      } else {
        client.send(JSON.stringify({ event: 'error', message: 'Invalid mode header' }));
      }
    }

    client.on('close', () => {
      console.log('Client disconnected');
    });
  }

  async handleDisconnect(client: WebSocket) {
    console.log('Client disconnected');
  }
}