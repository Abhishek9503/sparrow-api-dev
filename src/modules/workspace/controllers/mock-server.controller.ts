import { All, Controller, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// ---- Fastify
import { FastifyReply, FastifyRequest } from "fastify";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

/**
 * Mock Server Controller
 */
@ApiBearerAuth()
@ApiTags("mock-server")
@Controller("api/mock") // Base route for this controller
export class MockServerController {
  constructor() {}

  /**
   * Mock Server requests route, catches all the mock requests.
   */
  @ApiOperation({
    summary: "Get the mock server request",
    description:
      "All the mock server requests will come here and return saved response.",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiResponse({
    status: 201,
    description: "Received Mock request succcessfully",
  })
  @ApiResponse({ status: 400, description: "Failed to receive mock request" })
  @All("*")
  async getMockRequests(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const fullPath = req.url;
    console.log("fullPath", fullPath);
    return res.status(HttpStatusCode.ACCEPTED).send(fullPath);
  }
}
