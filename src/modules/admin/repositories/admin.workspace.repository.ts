import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findWorkspaceById(workspaceId: string) {
    const workspaceObjectId = new ObjectId(workspaceId);
    return this.db.collection("workspace").findOne({ _id: workspaceObjectId });
  }
}
