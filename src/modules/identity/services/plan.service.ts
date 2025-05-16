import { ForbiddenException, Injectable } from "@nestjs/common";

import {
  InsertOneResult,
  WithId,
} from "mongodb";
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
    private readonly userService: UserService
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
    console.log(userObject);
    console.log(userPlan);
    if(userPlan.name === "Community"){
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

  /**
   * Updates a team name
   * @param {string} id
   * @returns {Promise<ITeam>} mutated team data
   */
  // async update(
  //   id: string,
  //   teamData: Partial<UpdateTeamDto>,
  //   image?: MemoryStorageFile,
  // ): Promise<UpdateResult<Team>> {
  //   const teamOwner = await this.isTeamOwner(id);
  //   if (!teamOwner) {
  //     throw new BadRequestException("You don't have Access");
  //   }
  //   const teamDetails = await this.get(id);
  //   if (!teamDetails) {
  //     throw new BadRequestException(
  //       "The teams with that id does not exist in the system.",
  //     );
  //   }
  //   let team;
  //   if (image) {
  //     await this.isImageSizeValid(image.size);
  //     const dataBuffer = image.buffer;
  //     const dataString = dataBuffer.toString("base64");
  //     const logo = {
  //       bufferString: dataString,
  //       encoding: image.encoding,
  //       mimetype: image.mimetype,
  //       size: image.size,
  //     };
  //     team = {
  //       name: teamData.name ?? teamDetails.name,
  //       description: teamData.description ?? teamDetails.description,
  //       logo: logo,
  //       githubUrl: teamData?.githubUrl ?? teamDetails.githubUrl,
  //       linkedinUrl: teamData?.linkedinUrl ?? teamDetails.linkedinUrl,
  //       xUrl: teamData?.xUrl ?? teamDetails.xUrl,
  //     };
  //   } else {
  //     team = {
  //       name: teamData.name ?? teamDetails.name,
  //       description: teamData.description ?? teamDetails.description,
  //       githubUrl: teamData?.githubUrl ?? teamDetails.githubUrl,
  //       linkedinUrl: teamData?.linkedinUrl ?? teamDetails.linkedinUrl,
  //       xUrl: teamData?.xUrl ?? teamDetails.xUrl,
  //     };
  //   }
  //   const data = await this.teamRepository.update(id, team);
  //   if (teamData?.name) {
  //     const team = {
  //       teamId: teamDetails._id.toString(),
  //       teamName: teamData.name,
  //       teamWorkspaces: teamDetails.workspaces,
  //     };
  //     await this.producerService.produce(TOPIC.TEAM_DETAILS_UPDATED_TOPIC, {
  //       value: JSON.stringify(team),
  //     });
  //   }
  //   return data;
  // }

  /**
   * Delete a team from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  // async delete(id: string): Promise<DeleteResult> {
  //   const data = await this.teamRepository.delete(id);
  //   return data;
  // }

  async getAllPlans(): Promise<WithId<Plan>[]> {
    const data = await this.planRepository.getPlans();
    return data;
    }

}
