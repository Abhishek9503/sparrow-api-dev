import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "socket.io";

// ---- OpenAI
import { AzureOpenAI } from "openai";

// ---- Payload
import { StreamPromptPayload } from "../payloads/ai-assistant.payload";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
import { ChatbotStatsService } from "./chatbot-stats.service";

// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";

import { UserService } from "../../identity/services/user.service";
/**
 * Service for managing AI Assistant interactions.
 */
@Injectable()
export class AiAssistantService {
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;
  private maxTokens: number;
  private assistantsClient: AzureOpenAI;
  private monthlyTokenLimit: number;
  private assistantId: string;
  private assistant = { name: "API Instructor" };

  constructor(
    private readonly contextService: ContextService,
    private readonly configService: ConfigService,
    private readonly producerService: ProducerService,
    private readonly userService: UserService,
    private readonly chatbotStatsService: ChatbotStatsService,
  ) {
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");
    this.maxTokens = this.configService.get("ai.maxTokens");
    this.monthlyTokenLimit = this.configService.get("ai.monthlyTokenLimit");
    this.assistantId = this.configService.get("ai.assistantId");

    try {
      this.assistantsClient = new AzureOpenAI({
        endpoint: this.endpoint,
        apiVersion: this.apiVersion,
        apiKey: this.apiKey,
      });

      console.log("AzureOpenAI client initialized.");
    } catch (error) {
      console.error("Error initializing AzureOpenAI client:", error);
      throw new InternalServerErrorException(
        "Failed to initialize AI service.",
      );
    }
  }

  public async generateTextStream(
    data: StreamPromptPayload,
    client: Socket,
  ): Promise<void> {
    try {
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;
      const text = parsedData.text;
      let threadId = parsedData.threadId;
      const tabId = parsedData.tabId;
      const emailId = parsedData.emailId;

      console.log("Text:", text);
      console.log("ThreadId:", threadId);
      console.log("TabId:", tabId);
      console.log("EmailId:", emailId);

      const user = await this.userService.getUserByEmail(emailId);
      console.log("user:", user);
      const stat = await this.chatbotStatsService.getIndividualStat(
        user?._id?.toString(),
      );
      console.log("Stat:", stat);
      const currentYearMonth = this.chatbotStatsService.getCurrentYearMonth();
      if (
        stat?.tokenStats &&
        stat.tokenStats?.yearMonth === currentYearMonth &&
        stat.tokenStats.tokenUsage > (this.monthlyTokenLimit || 0)
      ) {
        throw new BadRequestException("Limit reached");
      }

      // Validate payload
      if (!text) {
        throw new BadRequestException(
          "Invalid input: 'text' field is required.",
        );
      }

      console.log("Text:", text);
      console.log("ThreadId:", threadId);

      if (!this.assistantsClient) {
        throw new InternalServerErrorException(
          "AI assistant client is not initialized.",
        );
      }

      const runAssistant = async () => {
        try {
          if (!threadId) {
            console.log("Creating a new thread");
            const assistantThread =
              await this.assistantsClient.beta.threads.create({});
            threadId = assistantThread.id;
          }

          await this.assistantsClient.beta.threads.messages.create(threadId, {
            role: "user",
            content: text,
          });

          const assistantResponse =
            await this.assistantsClient.beta.assistants.retrieve(
              this.assistantId,
            );
          const runResponse =
            await this.assistantsClient.beta.threads.runs.create(threadId, {
              assistant_id: assistantResponse.id,
            });

          let runStatus = runResponse.status;
          while (runStatus === "queued" || runStatus === "in_progress") {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const runStatusResponse =
              await this.assistantsClient.beta.threads.runs.retrieve(
                threadId,
                runResponse.id,
              );
            runStatus = runStatusResponse.status;
          }

          if (runStatus === "completed") {
            const messagesResponse =
              await this.assistantsClient.beta.threads.messages.list(threadId);

            const completedRun =
              await this.assistantsClient.beta.threads.runs.retrieve(
                threadId,
                runResponse.id,
              );
            const tokenUsage = completedRun.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            };

            console.log("Token Usage:", tokenUsage);

            const latestAssistantMessage = messagesResponse.data
              .filter((message) => message.role === "assistant")
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )[0];

            const assistantReply = latestAssistantMessage.content
              .filter((item) => item.type === "text")
              .map((item) => item.text.value)
              .join(" ");

            client.emit(`assistant-response_${tabId}`, {
              messages: assistantReply,
              thread_Id: threadId,
            });

            const userData = await this.userService.getUserByEmail(emailId);
            const id = userData._id.toString();
            console.log("User Data:", id);

            const kafkaMessage = {
              userId: id,
              tokenCount: tokenUsage,
            };
            await this.producerService.produce(
              TOPIC.AI_RESPONSE_GENERATED_TOPIC,
              {
                value: JSON.stringify(kafkaMessage),
              },
            );
          } else {
            console.error(
              `Run status is ${runStatus}, unable to fetch messages.`,
            );
            throw new InternalServerErrorException(
              "Assistant could not complete the request.",
            );
          }
        } catch (error) {
          client.emit(`assistant-response_${tabId}`, {
            messages:
              "Some Issue Occurred in Processing your Request. Please try again",
            thread_Id: threadId,
          });
        }
      };

      runAssistant();
    } catch (error) {
      client.emit("assistant-response", {
        messages: "Please try again",
        thread_Id: null,
      });
    }
  }
}
