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
    conversations: ConversationModel[] = []
  ): Promise<string[]> {

    // Get the MongoDB collection for LLM conversations
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase(); // Normalize provider name for use as field

    // Generate unique IDs for each conversation and ensure the conversation array exists
    const conversationsWithIds = conversations.map((conv) => ({
      ...conv,
      id: `${providerField}-conv-${uuidv4()}`, // Generate unique ID using provider prefix
      conversation: conv.conversation ?? [],   // Ensure conversation field is an array
    }));

    // --- Step 1: Attempt to add conversations to an existing provider + apiKey combo ---

    // Build query filter to find document where the provider array contains the apiKey
    const filter = {
      [providerField]: {
        $elemMatch: {
          value: apiKey,
        },
      },
    };

    // Build update operation to push new conversations to the matching provider/apiKey
    const updateExisting = {
      $push: {
        [`${providerField}.$.conversations`]: {
          $each: conversationsWithIds,
        },
      },
    };

    // Attempt to update the document
    const result = await collection.updateOne(filter, updateExisting);

    // If a document was updated, return the generated conversation IDs
    if (result.matchedCount > 0) {
      return conversationsWithIds.map((conv) => conv.id);
    }

    // --- Step 2: Provider exists but the apiKey does not; add new apiKey with conversations ---

    // Check if any document contains the provider field
    const providerDoc = await collection.findOne({ [providerField]: { $exists: true } });

    if (providerDoc) {
      // Add a new apiKey object under the existing provider field
      const addNewApiKey = {
        $push: {
          [providerField]: {
            value: apiKey,
            conversations: conversationsWithIds,
          },
        },
      };

      await collection.updateOne({ _id: providerDoc._id }, addNewApiKey);
      return conversationsWithIds.map((conv) => conv.id);
    }

    // --- Step 3: Provider does not exist; create it with the apiKey and conversations ---

    // Create a new provider field with the apiKey and conversations
    const newProviderEntry = {
      [providerField]: [
        {
          value: apiKey,
          conversations: conversationsWithIds,
        },
      ],
    };

    // Use upsert to create the new document if it doesn't exist
    await collection.updateOne({}, { $set: newProviderEntry }, { upsert: true });

    // Return the conversation IDs
    return conversationsWithIds.map((conv) => conv.id);
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
    dataArray: Array<Record<string, any>>,
  ): Promise<void> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    if (!dataArray || dataArray.length === 0) {
      throw new Error("No conversation data provided");
    }

    const data = dataArray[0];

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

    // Append messages
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
}