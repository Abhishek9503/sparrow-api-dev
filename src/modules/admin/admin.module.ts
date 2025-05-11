import { Module } from "@nestjs/common";

// ---- Module
import { IdentityModule } from "../identity/identity.module";

import { AdminHubsController } from "../admin/controllers/admin.hubs.controller";
import { AdminHubsRepository } from "../admin/repositories/admin.hubs.repository";
import { AdminHubsService } from "../admin/services/admin.hubs.service";
import { AdminWorkspaceRepository } from "./repositories/admin.workspace.repository";

/**
 * Admin Module provides all necessary services, handlers, repositories,
 * and controllers related to the admin dashboard functionality.
 */
@Module({
  imports: [IdentityModule],
  providers: [AdminHubsService, AdminHubsRepository, AdminWorkspaceRepository],
  exports: [AdminHubsService, AdminHubsRepository, AdminWorkspaceRepository],
  controllers: [AdminHubsController],
})
export class AdminModule {}
