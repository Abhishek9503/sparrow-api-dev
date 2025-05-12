import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findWorkspaceById(workspaceId: string) {
    const workspaceObjectId = new ObjectId(workspaceId);
    return this.db.collection("workspace").findOne({ _id: workspaceObjectId });
  }

  async findPaginatedByHubId(
    hubId: string,
    page: number,
    limit: number,
    search: string,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
    workspaceType?: "PRIVATE" | "PUBLIC",
  ) {
    const skip = (page - 1) * limit;

    const query: any = { "team.id": hubId };
    if (search) {
      query.name = { $regex: new RegExp(search, "i") };
    }
    if (workspaceType) {
      query.workspaceType = workspaceType;
    }

    const sortConfig: Record<string, 1 | -1> = {
      [sort.sortBy]: sort.sortOrder === "asc" ? 1 : -1,
    };

    const collection = this.db.collection("workspace");
    const total = await collection.countDocuments(query);
    const rawData = await collection
      .find(query)
      .sort(sortConfig)
      .skip(skip)
      .limit(limit)
      .toArray();

    return { total, rawData };
  }
}
