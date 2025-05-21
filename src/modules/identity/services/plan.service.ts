import { ForbiddenException, Injectable } from "@nestjs/common";

import { InsertOneResult, WithId } from "mongodb";
import { CreateOrUpdatePlanDto } from "../payloads/plan.payload";
import { Plan } from "@src/modules/common/models/plan.model";
import { PlanRepository } from "../repositories/plan.repository";
import { ContextService } from "@src/modules/common/services/context.service";
import { UserService } from "./user.service";

/**
 * Team Service
 */
@Injectable()
export class PlanService {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly contextService: ContextService,
    private readonly userService: UserService,
  ) {}

  /**
   * Creates a new plan in the database
   * @param {CreateOrUpdateTeamDto} planData
   * @returns  result of the insert operation
   */
  async create(
    planData: CreateOrUpdatePlanDto,
  ): Promise<InsertOneResult<Plan>> {
    const createdPlan = await this.planRepository.create(planData);
    return createdPlan;
  }

  /**
   * Fetches a plan from database by UUID
   * @param  id
   * @returns queried plan data
   */
  async get(id: string): Promise<WithId<Plan>> {
    const data = await this.planRepository.get(id);
    return data;
  }

   /**
   * Fetches a plan list from database by UUID
   * @returns queried plan data
   */
  async getAllPlans(): Promise<WithId<Plan>[]> {
    const data = await this.planRepository.getPlans();
    return data;
  }
}
