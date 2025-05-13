import {
  Controller,
  UseGuards,
  Get,
  Req,
  Res,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { ContextService } from "@src/modules/common/services/context.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AdminAuthService } from "../services/user-admin.auth.service";

/**
 * Interface for refresh token request
 */
export interface RefreshTokenRequest {
  user: {
    _id: string;
    refreshToken: string;
  };
}

@Controller("api/admin/auth")
@ApiTags("admin authentication")
export class AdminAuthController {
  private readonly OAUTH_SIGNUP_DELAY_MS = 5000;

  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly contextService: ContextService,
    private readonly configService: ConfigService,
  ) {}

  @Get("admin-login")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Generate admin access token",
    description: "Generates a short-lived token for accessing admin app",
  })
  @ApiResponse({ status: 200, description: "Token generated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async generateAdminToken(@Req() req: any, @Res() res: FastifyReply) {
    const user = this.contextService.get("user");
    const redirectUrl = this.configService.get("admin.redirectUrl");

    const token = await this.adminAuthService.createAdminToken(user._id);
    const data = {
      redirectUrl: `${redirectUrl}?token=${encodeURIComponent(token.token)}`,
      expiresIn: token.expires,
    };

    const responseData = new ApiResponseService(
      "Admin token generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("callback")
  @ApiOperation({ summary: "Handle admin login callback" })
  @ApiQuery({ name: "token", required: true, type: String })
  @ApiResponse({ status: 200, description: "Admin login successful" })
  @ApiResponse({ status: 400, description: "Token query param is required" })
  async handleAdminLogin(
    @Query("token") shortLivedToken: string,
    @Res() res: FastifyReply,
  ) {
    if (!shortLivedToken) {
      throw new BadRequestException("Token query param is required");
    }

    // Validate the short-lived token
    const tokens =
      await this.adminAuthService.validateShortLivedToken(shortLivedToken);

    const responseData = new ApiResponseService(
      "Admin login successful",
      HttpStatusCode.OK,
      tokens,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
