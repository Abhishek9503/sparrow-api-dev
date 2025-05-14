import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { WorkspaceRepository } from "@src/modules/workspace/repositories/workspace.repository";
import { ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceService {
  constructor(
    private readonly workspaceRepo: AdminWorkspaceRepository,
    private readonly adminHubService: AdminHubsRepository,
    private readonly workspaceRepository: WorkspaceRepository,
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
  async getPaginatedWorkspaceDetails(
    workspaceId: string,
    tab: string,
    page: number,
    limit: number,
    search: string,
    resource: "collections" | "testflows" | "environments" | "all" = "all",
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
  ) {
    const workspace = await this.workspaceRepository.get(workspaceId);

    if (tab === "resources") {
      const resources = [];

      // Only fetch collections if resource is 'collections' or 'all'
      if (resource === "collections" || resource === "all") {
        const collectionIds =
          workspace.collection?.map((c) => new ObjectId(c?.id)) || [];
        if (collectionIds.length > 0) {
          const collections =
            await this.workspaceRepo?.getFilteredCollectionsByIds(
              collectionIds.map((id) => id?.toString()),
              search,
              page,
              limit,
              sort,
            );

          const mappedCollections = collections.map((items) => ({
            resourceType: "collection",
            keyStats: items?.items?.length,
            name: items?.name,
            updatedAt: items?.updatedAt,
            updatedBy: items?.updatedBy?.name,
          }));

          resources.push(...mappedCollections);
        }
      }

      // Only fetch testflows if resource is 'testflows' or 'all'
      if (resource === "testflows" || resource === "all") {
        const testflowsId =
          workspace?.testflows?.map((c) => new ObjectId(c?.id)) || [];
        if (testflowsId.length > 0) {
          const testflows = await this.workspaceRepo?.getFiteredTestFlowsById(
            testflowsId.map((id) => id?.toString()),
            search,
            page,
            limit,
            sort,
          );
          const mappedTestflows = testflows.map((items) => ({
            resourceType: "testflow",
            name: items?.name,
            keyStats: items?.nodes?.length,
            updatedAt: items?.updatedAt,
            updatedBy: items?.updatedByUser[0]?.name,
          }));

          resources.push(...mappedTestflows);
        }
      }

      // Only fetch environments if resource is 'environments' or 'all'
      if (resource === "environments" || resource === "all") {
        const environmentsId =
          workspace?.environments?.map((c) => new ObjectId(c?.id)) || [];
        if (environmentsId.length > 0) {
          const environments =
            await this.workspaceRepo.getFilteredEnvironmentsById(
              environmentsId.map((id) => id.toString()),
              search,
              page,
              limit,
              sort,
            );

          const mappedEnvironments = environments.map((items) => ({
            resourceType: "environment",
            keyStats: items?.variable?.length,
            updatedAt: items?.updatedAt,
            updatedBy: items?.updatedBy,
            name: items?.name,
          }));

          resources.push(...mappedEnvironments);
        }
      }

      return resources;
    } else {
      const users = workspace?.users?.map((item) => ({
        user: item?.name,
        _id: item?.id,
        role: item?.role,
        email: item?.email,
      }));
      const data = { users };
      return data;
    }
  }
  async getWorkspaceSummary(workspaceId: string) {
    const workspace = await this.workspaceRepository.get(workspaceId);

    const workspace_summary = {
      collections: workspace?.collection.length,
      contributors: workspace.users.filter((user) => user.role !== "viewer")
        .length,
      testFlows: workspace.testflows.length,
      environments: workspace.environments.length,
    };

    return workspace_summary;
  }
}
