import {
  Controller,
  Get,
  UseGuards,
  Req,
  Param,
  Res,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { AdminHubsService } from "../services/admin.hubs.service";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
@Controller("admin")
@ApiTags("admin hubs")
@ApiBearerAuth()
export class AdminHubsController {
  constructor(private readonly hubsService: AdminHubsService) {}
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hubs")
  @ApiOperation({ summary: "Get hubs for logged-in user" })
  async getHubs(@Req() req: any, @Res() res: FastifyReply) {
    // Extract user ID from the decoded JWT
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }
    const data = await this.hubsService.getHubsForUser(userId);

    const responseData = new ApiResponseService(
      "Hubs generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hubs-summary")
  @ApiOperation({ summary: "Get summary of all hubs for user" })
  async getHubsSummary(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    const data = await this.hubsService.getAllHubsSummaryForUser(userId);

    const responseData = new ApiResponseService(
      "Hubs summary generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("all-hubs")
  @ApiOperation({ summary: "Get paginated hubs list with search" })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiQuery({ name: "limit", required: false, type: String, example: "10" })
  @ApiQuery({ name: "search", required: false, type: String })
  async getAllHubs(
    @Req() req: any,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search: string = "",
    @Query("sortBy") sortBy: "createdAt" | "updatedAt" | "name" = "createdAt",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Res() res: FastifyReply,
  ) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    // Convert string parameters to numbers
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    // Validate sort parameters
    const validSortFields = ["createdAt", "updatedAt", "name"];
    const validatedSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";
    const validatedSortOrder = ["asc", "desc"].includes(sortOrder)
      ? sortOrder
      : "desc";

    const data = await this.hubsService.getAllHubsForUser(
      userId,
      parsedPage || 1,
      parsedLimit || 10,
      search,
      {
        sortBy: validatedSortBy,
        sortOrder: validatedSortOrder,
      },
    );

    const responseData = new ApiResponseService(
      "Hubs list generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
