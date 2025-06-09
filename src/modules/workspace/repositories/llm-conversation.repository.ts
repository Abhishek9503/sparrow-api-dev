import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";

// Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LlmConversation , ConversationModel , UserConversationModel } from "../payloads/llm-conversation.payload";

@Injectable()
export class LlmConversationRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async getConversations(
    provider: string,
    apiKey: string,
    id?: string
  ): Promise<ConversationModel[] | ConversationModel | null> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    const document = await collection.findOne({
      [providerField]: {
        $elemMatch: {
          value: apiKey,
        },
      },
    });

    if (!document || !document[providerField]) {
      return id ? null : [];
    }

    const providerEntry = document[providerField].find(
      (entry: { value: string }) => entry.value === apiKey
    );

    if (!providerEntry) {
      return id ? null : [];
    }

    const conversations = providerEntry.conversations ?? [];

    // If ID is provided, return that specific conversation
    if (id) {
      const conversation = conversations.find((conv: any) => conv.id === id);
      return conversation || null;
    }

    return conversations;
  }


  async insertConversation(
    provider: string,
    apiKey: string,
    conversation: ConversationModel
  ): Promise<string> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    const conversationWithId = {
      ...conversation,
      id: `${providerField}-conv-${uuidv4()}`,
      conversation: conversation.conversation ?? [],
    };

    const filter = {
      [providerField]: {
        $elemMatch: {
          value: apiKey,
        },
      },
    };

    const updateExisting = {
      $push: {
        [`${providerField}.$.conversations`]: conversationWithId,
      },
    };

    const result = await collection.updateOne(filter, updateExisting);

    if (result.matchedCount > 0) {
      return conversationWithId.id;
    }

    const providerDoc = await collection.findOne({ [providerField]: { $exists: true } });

    if (providerDoc) {
      const addNewApiKey = {
        $push: {
          [providerField]: {
            value: apiKey,
            conversations: [conversationWithId],
          },
        },
      };

      await collection.updateOne({ _id: providerDoc._id }, addNewApiKey);
      return conversationWithId.id;
    }

    const newProviderEntry = {
      [providerField]: [
        {
          value: apiKey,
          conversations: [conversationWithId],
        },
      ],
    };

    await collection.insertOne(newProviderEntry);
    return conversationWithId.id;
}

  /**
   * Adds a conversation to the given provider and API key group.
   *
   * @param provider e.g. "openAI"
   * @param apiKey e.g. "sk-openai-abc-123"
   * @param conversation conversation object to insert
   */
  async addConversation(
    provider: string,
    apiKey: string,
    conversationId: string,
    data: Record<string, any>,
  ): Promise<void> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    if (!data) {
      throw new Error("No conversation data provided");
    }

    const messagesToAppend = data.conversation ?? [];
    const { conversation, id, ...metaUpdates } = data;

    const updateOps: any = {};

    // Set only explicitly defined fields (e.g. title, tokens)
    for (const key in metaUpdates) {
      const value = metaUpdates[key];
      if (value !== undefined) {
        updateOps.$set = updateOps.$set || {};
        updateOps.$set[`${providerField}.$[apiKeyElem].conversations.$[convElem].${key}`] = value;
      }
    }

    // Append messages to existing conversation
    if (messagesToAppend.length > 0) {
      updateOps.$push = {
        [`${providerField}.$[apiKeyElem].conversations.$[convElem].conversation`]: {
          $each: messagesToAppend,
        },
      };
    }

    // Skip if there's nothing to update
    if (!updateOps.$set && !updateOps.$push) return;

    await collection.updateOne(
      {
        [`${providerField}.value`]: apiKey,
        [`${providerField}.conversations.id`]: conversationId,
      },
      updateOps,
      {
        arrayFilters: [
          { "apiKeyElem.value": apiKey },
          { "convElem.id": conversationId },
        ],
      }
    );
  }

  async deleteConversation(provider: string, apiKey: string, conversationId: string): Promise<void> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    await collection.updateOne(
      {
        [`${providerField}.value`]: apiKey,
      },
      {
        $pull: {
          [`${providerField}.$.conversations`]: { id: conversationId },
        },
      }
    );
  }
}