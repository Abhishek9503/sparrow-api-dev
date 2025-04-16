import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, UpdateResult } from "mongodb";
import { CreateNonUser, UpdateNonUser } from "../payloads/nonUser.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { UnregisteredUser } from "@src/modules/common/models/nonregistered-users.model";

@Injectable()
export class NonUserRepository {
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
    const unregisteredUser = {
      email,
      teamIds,
      createdAt: new Date(),
    };
    const result = await this.db
      .collection<UnregisteredUser>(Collections.NONREGISTEREDUSER)
      .insertOne(unregisteredUser);
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
      .collection<UnregisteredUser>(Collections.NONREGISTEREDUSER)
      .updateOne({ email }, { $addToSet: { teamIds: { $each: teamIds } } });
    return result;
  }

  /**
   * Retrieves a non-user by their email
   * @param email {string}
   * @returns {Promise<UnregisteredUser | null>}
   */
  async getByEmail(email: string): Promise<UnregisteredUser | null> {
    return this.db
      .collection<UnregisteredUser>(Collections.NONREGISTEREDUSER)
      .findOne({ email });
  }
}
