import { Injectable } from "@nestjs/common";

// Payload
import { ConversationModel, LlmConversation } from "../payloads/llm-conversation.payload";

// Repository
import { LlmConversationRepository } from "../repositories/llm-conversation.repository";

@Injectable()
export class LlmConversationService {
  constructor(
    private readonly llmConversationRepository: LlmConversationRepository,
  ) {}

  // 
  async getConversation(provider: string , apiKey: string, id?: string): Promise<ConversationModel[] | ConversationModel | null> {
    return await this.llmConversationRepository.getConversations(
      provider,
      apiKey,
      id
    );
  }

  // Function to Create a root structure of Conversation in DB
  async insertConversation(payload: LlmConversation): Promise<string> {
    const id = await this.llmConversationRepository.insertConversation(
      payload.provider,
      payload.apiKey,
      payload.data,
    );
    return id;
  }

  async updateConversation(payload: LlmConversation): Promise<void> {
    await this.llmConversationRepository.addConversation(
      payload.provider,
      payload.apiKey,
      payload.id,
      payload.data,
    );
  }

  async deleteConversation(provider: string, apiKey: string, id: string): Promise<void> {
    await this.llmConversationRepository.deleteConversation(provider, apiKey, id);
  }
}