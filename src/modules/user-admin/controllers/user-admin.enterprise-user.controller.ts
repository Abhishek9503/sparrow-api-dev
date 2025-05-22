import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AdminUsersService } from "../services/user-admin.enterprise-user.service";

@Controller("api/admin")
@ApiTags("admin users")
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("enterpriseUsers")
  @ApiOperation({
    summary: "Get all the users in hub in which the logged in user is owner",
  })
  async getUsers(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID is missing from token");
    }
    const data = await this.usersService.getAllUsers(userId);
    const responseData = new ApiResponseService(
      "Users Generated",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("enterpriseUsers-details")
  @ApiOperation({
    summary: "Get user details for the enterprise logged in user is owner",
  })
  async getUsersDetails(
    @Req() req: any,
    @Query("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    const ownerId = req.user._id;

    if (!ownerId) {
      throw new UnauthorizedException("User ID is missing from token");
    }
    const data = await this.usersService.getUserDetails(ownerId, userId);
    const responseData = new ApiResponseService(
      "Users Generated",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
