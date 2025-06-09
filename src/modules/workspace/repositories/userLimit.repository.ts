import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult } from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";

import { UserLimitLog } from "@src/modules/common/models/user-limit.model";

/**
 * UserLimitRepository - Handles DB operations related to user usage limits.
 */
@Injectable()
export class UserLimitRepository {
  /**
   * Constructs the UserLimitRepository.
   *
   * @param {Db} db - MongoDB database instance.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Counts the number of requests made by a user in a specific team within a given month.
   *
   * @param {string} userId - The user's ID.
   * @param {string} teamId - The team's ID.
   * @param {string} month - The month in YYYY-MM format.
   * @returns {Promise<number>} - The count of requests.
   */
  async countRequests(
    userId: string,
    teamId: string,
    month: string,
  ): Promise<number> {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(new Date(start).setMonth(start.getMonth() + 1));

    return await this.db
      .collection<UserLimitLog>(Collections.USERLIMITLOGS)
      .countDocuments({
        userId,
        teamId,
        requestedAt: { $gte: start, $lt: end },
      });
  }

  /**
   * Logs a new user request into the usage log collection.
   *
   * @param {UserLimitLog} log - Log data to be inserted.
   * @returns {Promise<InsertOneResult>} - The result of the insert operation.
   */
  async logRequest(log: UserLimitLog): Promise<InsertOneResult> {
    return await this.db
      .collection<UserLimitLog>(Collections.USERLIMITLOGS)
      .insertOne(log);
  }
}
