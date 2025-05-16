import { Controller, Get, UseGuards, Res, Query } from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiExtraModels,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { AdminMembersService } from "../services/user-admin.members.service";
import {
  HubMembersQuerySwaggerDto,
  HubInvitesQuerySwaggerDto,
} from "../payloads/members.payload";

@Controller("api/admin")
@ApiTags("admin hub members")
@ApiBearerAuth()
export class AdminMembersController {
  constructor(private readonly adminMembersService: AdminMembersService) {}

  @ApiExtraModels(HubMembersQuerySwaggerDto)
  @ApiQuery({ type: HubMembersQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-members")
  @ApiOperation({ summary: "Get paginated members for a hub" })
  async getHubMembers(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Res() res: FastifyReply,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const data = await this.adminMembersService.getPaginatedHubMembers(
      hubId,
      parsedPage,
      parsedLimit,
      search,
    );

    const responseData = new ApiResponseService(
      "Hub members generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @ApiExtraModels(HubInvitesQuerySwaggerDto)
  @ApiQuery({ type: HubInvitesQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-invites")
  @ApiOperation({ summary: "Get paginated invites for a hub" })
  async getHubInvites(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Res() res: FastifyReply,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const data = await this.adminMembersService.getPaginatedHubInvites(
      hubId,
      parsedPage,
      parsedLimit,
      search,
    );

    const responseData = new ApiResponseService(
      "Hub invites generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
