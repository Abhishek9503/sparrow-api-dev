import { Body, Controller, Post, Req, Res, UseGuards, Get, Query, Delete } from "@nestjs/common";
import { ApiQuery } from '@nestjs/swagger';
import { AiAssistantService } from "../services/ai-assistant.service";
import { FastifyReply } from "fastify";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  PromptPayload,
  ErrorResponsePayload,
  ChatBotPayload,
} from "../payloads/ai-assistant.payload";
import { LlmConversation } from "../payloads/llm-conversation.payload";
import { LlmConversationService } from "../services/llm-conversation.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";

@ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api/assistant")
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  /**
   * Constructor to initialize AiAssistantController with the required service.
   * @param aiAssistantService - Injected AiAssistantService to handle business logic.
   * * @param llmConversationService - Injected LlmConversationService to handle LLM conversation logic.
   */
  constructor(private readonly aiAssistantService: AiAssistantService , private readonly llmConversationService: LlmConversationService) {}

  @ApiOperation({
    summary: "Get a respose for AI assistant",
    description: "this will return AI response from the input prompt",
  })
  @ApiResponse({
    status: 201,
    description: "AI response Generated Successfully",
  })
  @ApiResponse({ status: 400, description: "Generate AI Response Failed" })
  @Post("prompt")
  async generate(
    @Body() prompt: PromptPayload,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.aiAssistantService.generateText(prompt, user);
    const response = new ApiResponseService(
      "AI Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("specific-error")
  async CurlError(
    @Body() errorResponse: ErrorResponsePayload,
    @Res() res: FastifyReply,
  ) {
    const data = await this.aiAssistantService.specificError(errorResponse);
    const response = new ApiResponseService(
      "AI Error Handler Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("generate-prompt")
  async GeneratePrompt(@Body() payload: ChatBotPayload, @Res() res: FastifyReply) {
    const data = await this.aiAssistantService.promptGeneration(payload);
    const response = new ApiResponseService(
      "Prompt Generated Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Get("get-conversation")
  @ApiQuery({ name: 'provider', required: true })
  @ApiQuery({ name: 'apiKey', required: true })
  @ApiQuery({ name: 'id', required: false })
  async GetConversation(
    @Query("provider") provider: string,
    @Query("apiKey") apiKey: string,
    @Query("id") id: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.llmConversationService.getConversation(provider, apiKey, id);
    const response = new ApiResponseService(
      "Conversation fetched successfully",
      HttpStatusCode.OK,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("insert-conversation")
  async InsertConversation(@Body() payload: LlmConversation, @Res() res: FastifyReply) {
    const data = await this.llmConversationService.insertConversation(payload);
    const response = new ApiResponseService(
      "Conversation Inserted Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }
  @Post("update-conversation")
  async UpdateConversation(@Body() payload: LlmConversation, @Res() res: FastifyReply) {
    const data = await this.llmConversationService.updateConversation(payload);
    const response = new ApiResponseService(
      "Conversation Updated Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Delete("delete-conversation")
  @ApiQuery({ name: 'provider', required: true })
  @ApiQuery({ name: 'apiKey', required: true })
  @ApiQuery({ name: 'id', required: true })
  async DeleteConversation(
    @Query("provider") provider: string,
    @Query("apiKey") apiKey: string,
    @Query("id") id: string,
    @Res() res: FastifyReply,
  ) {
    await this.llmConversationService.deleteConversation(provider, apiKey, id);
    const response = new ApiResponseService(
      "Conversation deleted successfully",
      HttpStatusCode.OK,
      null,
    );
    return res.status(response.httpStatusCode).send(response);
  }

}
