import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model
import { AiLogs } from "@src/modules/common/models/ai-log.model";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";

/**
 * ChatbotStatsRepository
 *
 * Repository class for handling chatbot statistics related operations with MongoDB.
 */
@Injectable()
export class AiLogRepository {
  /**
   * Constructor for ChatbotStatsRepository.
   * @param db The MongoDB database connection injected by the NestJS dependency injection system.
   * @param contextService The service for accessing context-related information like the current user.
   */
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addLogs(
    payload: AiLogs,
    userId: string = null,
  ): Promise<InsertOneResult<Document>> {
    const defaultParams = {
      createdAt: new Date(),
      createdBy: this.contextService.get("user")?._id ?? userId,
    };
  
    const data = await this.db
      .collection(Collections.AILOGS)
      .insertOne({ ...payload, ...defaultParams });
  
    return data;
  }

}