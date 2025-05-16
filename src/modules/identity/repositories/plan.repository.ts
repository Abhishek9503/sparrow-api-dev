import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { CreateOrUpdatePlanDto } from "../payloads/plan.payload";
import { Plan } from "@src/modules/common/models/plan.model";

/**
 * Team Service
 */
@Injectable()
export class PlanRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async create(
    planData: CreateOrUpdatePlanDto,
  ): Promise<InsertOneResult<Plan>> {
    const params = {
      createdBy: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "system",
    };

    const createdPlan = await this.db
      .collection<Plan>(Collections.PLAN)
      .insertOne({
        ...planData,
        ...params,
      });
    return createdPlan;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async get(id: string): Promise<WithId<Plan>> {
    const _id = new ObjectId(id);
    const plan = await this.db
      .collection<Plan>(Collections.PLAN)
      .findOne({ _id });
    if (!plan) {
      throw new BadRequestException(
        "The Plan with that id could not be found.",
      );
    }
    return plan;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async getPlans(): Promise<WithId<Plan>[]> {
    const plans = await this.db
      .collection<Plan>(Collections.PLAN)
      .find()
      .toArray();
    return plans;
  }
}
