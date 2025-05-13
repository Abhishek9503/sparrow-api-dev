import { Injectable, Inject } from "@nestjs/common";
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
}
