import {
  Controller,
  Get,
  UseGuards,
  Post,
  Res,
  Query,
  Body,
} from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { AdminWorkspaceService } from "../services/admin.workspace.service";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { CreateWorkspaceDto } from "@src/modules/workspace/payloads/workspace.payload";

@Controller("admin")
@ApiTags("admin workspace")
@ApiBearerAuth()
export class AdminWorkspaceController {
  constructor(
    private readonly adminWorkspaceService: AdminWorkspaceService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-workspaces")
  @ApiOperation({ summary: "Get paginated workspaces for a hub" })
  @ApiQuery({ name: "hubId", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiQuery({ name: "limit", required: false, type: String, example: "10" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["name", "workspaceType", "createdAt", "updatedAt"],
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiQuery({
    name: "workspaceType",
    required: false,
    enum: ["PRIVATE", "PUBLIC"],
    description:
      "Filter workspaces by visibility type. Leave empty to include all.",
  })
  async getPaginatedHubWorkspaces(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Query("sortBy")
    sortBy: "name" | "workspaceType" | "createdAt" | "updatedAt" = "createdAt",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Query("workspaceType") workspaceType: "PRIVATE" | "PUBLIC" | undefined,
    @Res() res: FastifyReply,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const validatedSortBy = [
      "name",
      "workspaceType",
      "createdAt",
      "updatedAt",
    ].includes(sortBy)
      ? sortBy
      : "createdAt";
    const validatedSortOrder = ["asc", "desc"].includes(sortOrder)
      ? sortOrder
      : "desc";

    const data = await this.adminWorkspaceService.getPaginatedHubWorkspaces(
      hubId,
      parsedPage,
      parsedLimit,
      search,
      { sortBy: validatedSortBy, sortOrder: validatedSortOrder },
      workspaceType,
    );

    const responseData = new ApiResponseService(
      "Hub workspaces generated",
      HttpStatusCode.OK,
      {
        ...data,
        sortBy: validatedSortBy,
        sortOrder: validatedSortOrder,
        workspaceType,
      },
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("create-workspace")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Create a new Workspace as Admin",
    description: "Admins can create a workspace with optional description",
  })
  @ApiResponse({
    status: 201,
    description: "Admin Workspace Created Successfully",
  })
  @ApiResponse({ status: 400, description: "Admin Create Workspace Failed" })
  async adminCreateWorkspace(
    @Body() adminCreateDto: CreateWorkspaceDto,
    @Res() res: FastifyReply,
  ) {
    const data = await this.workspaceService.create(adminCreateDto);

    const workspace = await this.workspaceService.get(
      data.insertedId.toString(),
    );

    const responseData = new ApiResponseService(
      "Admin Workspace Created",
      HttpStatusCode.CREATED,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
