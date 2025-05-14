import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Collection } from "@src/modules/common/models/collection.model";
import { Environment } from "@src/modules/common/models/environment.model";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findWorkspaceById(workspaceId: string) {
    const workspaceObjectId = new ObjectId(workspaceId);
    return this.db.collection("workspace").findOne({ _id: workspaceObjectId });
  }

  async findPaginated(query: any, sort: any, skip: number, limit: number) {
    const collection = this.db.collection("workspace");

    const total = await collection.countDocuments(query);
    const rawData = await collection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return { total, rawData };
  }

  async getTotalWorkspaceCount(query: any): Promise<number> {
    return await this.db.collection("workspace").countDocuments(query);
  }
  async getFilteredCollectionsByIds(
    ids: string[] = [],
    search: string,
    page: number,
    limit: number,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
  ): Promise<Collection[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, "i");

    const allowedSortFields = ["name", "createdAt", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const query = {
      _id: { $in: objectIds },
      name: { $regex: searchRegex },
    };

    const collections = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    return collections;
  }
  async getFiteredTestFlowsById(
    ids: string[] = [],
    search: string,
    page: number,
    limit: number,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
  ): Promise<any[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const skip = (page - 1) * limit;

    const allowedSortFields = ["name", "createdAt", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const testflows = await this.db
      .collection<any>(Collections.TESTFLOW)
      .aggregate([
        {
          $match: {
            _id: { $in: objectIds },
            name: { $regex: search, $options: "i" },
          },
        },
        {
          $addFields: {
            updatedByObjId: { $toObjectId: "$updatedBy" },
          },
        },
        {
          $sort: {
            [sortBy]: sortOrder,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: "user",
            localField: "updatedByObjId",
            foreignField: "_id",
            as: "updatedByUser",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            updatedAt: 1,
            updatedBy: 1,
            nodes: 1,
            updatedByUser: 1,
          },
        },
      ])
      .toArray();

    return testflows;
  }

  async getFilteredEnvironmentsById(
    ids: string[] = [],
    search: string,
    page: number,
    limit: number,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
  ): Promise<Environment[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, "i");

    const allowedSortFields = ["name", "createdAt", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const query = {
      _id: { $in: objectIds },
      name: { $regex: searchRegex },
    };

    const environments = await this.db
      .collection<Environment>(Collections.ENVIRONMENT)
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    return environments;
  }
}
