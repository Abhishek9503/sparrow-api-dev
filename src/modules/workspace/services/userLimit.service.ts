import { Injectable } from "@nestjs/common";
import { UserLimitRepository } from "../repositories/userLimit.repository";

/**
 * UserLimitService - Handles logic for user request limits and usage logging.
 */
@Injectable()
export class UserLimitService {
  constructor(
    private readonly userLimitRepository: UserLimitRepository,
    // optional
    // private readonly contextService: ContextService,
  ) {}

  /**
   * Checks if the user has reached their request limit and logs the request if allowed.
   * @param userId - ID of the user.
   * @param teamId - ID of the team.
   * @param plan - Subscription plan (e.g., 'standard', 'community', 'pro').
   * @returns 'OK' if within limit, or 'LIMIT REACHED'.
   */
  async checkLimitAndLogRequest(
    userId: string,
    teamId: string,
    plan: string,
  ): Promise<"OK" | "LIMIT REACHED"> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    console.log("This is plan=========================>", plan);

    const limit =
      plan === "standard" ? 17 : plan === "community" ? 6 : Infinity;

    const usageCount = await this.userLimitRepository.countRequests(
      userId,
      teamId,
      currentMonth,
    );

    console.log("Thi is the limit ", limit);
    console.log("Thi is the this is usuage count  ", usageCount);

    if (usageCount >= limit) {
      return "LIMIT REACHED";
    }

    
    await this.userLimitRepository.logRequest({
      userId,
      teamId,
      requestedAt: new Date(),
    });

    return "OK";
  }
}
