import { Injectable } from "@nestjs/common";
import { UserLimitRepository } from "../repositories/userLimit.repository";

/**
 * UserLimitService - Handles logic for user request limits and usage logging.
 *
 *  Current Mode:
 * - Request limits are tracked monthly using the calendar month (YYYY-MM).
 *
 *  TODO Future Upgrade Plan: 
 * - Switch to billing-cycle-based tracking using billing.periodStart and billing.periodEnd
 *   once the billing module is fully implemented.
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
  

    const start = new Date(`${currentMonth}-01T00:00:00Z`);
    const end = new Date(new Date(start).setMonth(start.getMonth() + 1));

    const limit =
      plan === "standard" ? 50 : plan === "community" ? 200 : Infinity;

    const usageCount = await this.userLimitRepository.countRequests(
      userId,
      teamId,
      start,
      end,
    );

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
