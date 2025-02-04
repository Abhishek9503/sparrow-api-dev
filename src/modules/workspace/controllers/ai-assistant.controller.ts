// import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
// import { AiAssistantService } from "../services/ai-assistant.service";
// import { FastifyReply } from "fastify";
// import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
// import { ApiResponseService } from "@src/modules/common/services/api-response.service";
// import {
//   ApiBearerAuth,
//   ApiOperation,
//   ApiResponse,
//   ApiTags,
// } from "@nestjs/swagger";
// import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
// import { PromptPayload } from "../payloads/ai-assistant.payload";

// @ApiBearerAuth()
// @ApiTags("AI Support")
// @Controller("api/assistant")
// @UseGuards(JwtAuthGuard)
// export class AiAssistantController {
//   /**
//    * Constructor to initialize AiAssistantController with the required service.
//    * @param aiAssistantService - Injected AiAssistantService to handle business logic.
//    */
//   constructor(private readonly aiAssistantService: AiAssistantService) {}

//   @ApiOperation({
//     summary: "Get a respose for AI assistant",
//     description: "this will return AI response from the input prompt",
//   })
//   @ApiResponse({
//     status: 201,
//     description: "AI response Generated Successfully",
//   })
//   @ApiResponse({ status: 400, description: "Generate AI Response Failed" })
//   @Post("prompt")
//   async generate(@Body() prompt: PromptPayload, @Res() res: FastifyReply) {
//     const data = await this.aiAssistantService.generateText(prompt);
//     const response = new ApiResponseService(
//       "AI Reposonse Generated",
//       HttpStatusCode.CREATED,
//       data,
//     );
//     return res.status(response.httpStatusCode).send(response);
//   }
// }

import { Controller, Post, Body, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { Socket } from "socket.io-client"; // Import socket.io client
import { PromptPayload } from "../payloads/ai-assistant.payload";

@Controller("api/assistant")
export class AiAssistantController {
  private socket: Socket;

  // constructor() {
  //   // Initialize socket connection to the server (assuming your server runs on localhost)
  //   this.socket = require('socket.io-client')('http://localhost:9002'); // Replace with your server URL if different
  // }

  @Post("prompt")
  async generate(@Body() prompt: PromptPayload, @Res() res: FastifyReply) {
    // Send the message to the Socket.IO server
    this.socket.emit("sendPrompt", prompt);

    // Listen for the response from the server
    this.socket.on("assistant-response", (response) => {
      // Send the response back to the HTTP client (Postman)
      return res.status(200).send({
        message: "AI Response Generated",
        data: response,
      });
    });

    // In case of timeout or error
    setTimeout(() => {
      return res.status(500).send({
        message: "Failed to get response from AI assistant.",
      });
    }, 5000); // Wait for 5 seconds before timing out
  }
}
