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
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneResult<Team>>} result of the insert operation
   */
  async create(
    planData: CreateOrUpdatePlanDto,
  ): Promise<InsertOneResult<Plan>> {
    const createdPlan = await this.planRepository.create(planData);
    return createdPlan;
  }

  async limitTeamsCreation() {
    const user = await this.contextService.get("user");
    const userObject = await this.userService.getUserById(user._id.toString());
    const userPlan = await this.get(userObject.planId.toString());

    const event = userPlan.limits.ownedHub;
    if (userObject.hubCount >= event.value) {
      throw new ForbiddenException("Cant create new Hubs in community plan");
    }
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async get(id: string): Promise<WithId<Plan>> {
    const data = await this.planRepository.get(id);
    return data;
  }

  async getAllPlans(): Promise<WithId<Plan>[]> {
    const data = await this.planRepository.getPlans();
    return data;
  }
}
