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
    const { total, rawData } = await this.workspaceRepo.findPaginatedByHubId(
      hubId,
      page,
      limit,
      search,
      sort,
      workspaceType,
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
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
      limit,
      hubs: workspaces,
    };
  }
}
