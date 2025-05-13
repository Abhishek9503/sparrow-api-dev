import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";

@Injectable()
export class AdminWorkspaceService {
  constructor(
    private readonly workspaceRepo: AdminWorkspaceRepository,
    private readonly adminHubService: AdminHubsRepository,
  ) {}

  async getPaginatedHubWorkspaces(
    hubId: string,
    page: number,
    limit: number,
    search: string,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
    workspaceType?: "PRIVATE" | "PUBLIC",
  ) {
    const skip = (page - 1) * limit;

    const query: any = { "team.id": hubId };

    const totalWorkspaceCount =
      await this.workspaceRepo.getTotalWorkspaceCount(query);

    if (search) {
      query.name = { $regex: new RegExp(search, "i") };
    }
    if (workspaceType) {
      query.workspaceType = workspaceType;
    }

    const sortConfig: Record<string, 1 | -1> = {
      [sort.sortBy]: sort.sortOrder === "asc" ? 1 : -1,
    };

    const { total, rawData } = await this.workspaceRepo.findPaginated(
      query,
      sortConfig,
      skip,
      limit,
    );

    const hub = await this.adminHubService.findHubById(hubId);
    if (!hub) throw new NotFoundException("Hub not found");

    const workspaces = rawData.map((ws) => ({
      id: ws._id,
      name: ws.name,
      visibility: ws.workspaceType,
      contributors: ws.users?.length || 0,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      collections: ws.collection?.length || 0,
    }));

    return {
      hubName: hub.name,
      isNewHub: totalWorkspaceCount === 0,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
      limit,
      hubs: workspaces,
    };
  }
}
