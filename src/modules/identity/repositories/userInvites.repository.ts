import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, UpdateResult } from "mongodb";
import { CreateNonUser, UpdateNonUser } from "../payloads/userInvites.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { UserInvites } from "@src/modules/common/models/user-invites.model";

@Injectable()
export class UserInvitesRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private readonly db: Db,
  ) {}

  /**
   * Creates a new unregistered user in the database
   * @param payload {CreateNonUser}
   * @returns {Promise<InsertOneResult>} result of the insert operation
   */
  async create(payload: CreateNonUser): Promise<InsertOneResult> {
    const { email, teamIds } = payload;
    const UserInvites = {
      email,
      teamIds,
      createdAt: new Date(),
    };
    const result = await this.db
      .collection<UserInvites>(Collections.NONREGISTEREDUSER)
      .insertOne(UserInvites);
    return result;
  }

  /**
   * Updates a non-user's teamIds by pushing all provided teamIds
   * @param payload {UpdateNonUser}
   * @returns {Promise<UpdateResult>}
   */
  async update(payload: UpdateNonUser): Promise<UpdateResult> {
    const { email, teamIds } = payload;
    const result = await this.db
      .collection<UserInvites>(Collections.NONREGISTEREDUSER)
      .updateOne({ email }, { $set: { teamIds: teamIds } });
    return result;
  }

  /**
   * Retrieves a non-user by their email
   * @param email {string}
   * @returns {Promise<UserInvites | null>}
   */
  async getByEmail(email: string): Promise<UserInvites | null> {
    return this.db
      .collection<UserInvites>(Collections.NONREGISTEREDUSER)
      .findOne({ email });
  }
}
