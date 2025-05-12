import { Module } from "@nestjs/common";

// ---- Module
import { IdentityModule } from "../identity/identity.module";

import { AdminHubsController } from "../admin/controllers/admin.hubs.controller";
import { AdminHubsRepository } from "../admin/repositories/admin.hubs.repository";
import { AdminHubsService } from "../admin/services/admin.hubs.service";
import { AdminWorkspaceRepository } from "./repositories/admin.workspace.repository";
import { AdminWorkspaceService } from "./services/admin.workspace.service";
import { AdminWorkspaceController } from "./controllers/admin.workspace.controller";
import { WorkspaceService } from "../workspace/services/workspace.service";
import { WorkspaceModule } from "../workspace/workspace.module";

/**
 * Admin Module provides all necessary services, handlers, repositories,
 * and controllers related to the admin dashboard functionality.
 */
@Module({
  imports: [IdentityModule, WorkspaceModule],
  providers: [
    WorkspaceService,
    AdminHubsService,
    AdminHubsRepository,
    AdminWorkspaceService,
    AdminWorkspaceRepository,
  ],
  exports: [
    AdminHubsService,
    AdminHubsRepository,
    AdminWorkspaceService,
    AdminWorkspaceRepository,
  ],
  controllers: [AdminHubsController, AdminWorkspaceController],
})
export class AdminModule {}
