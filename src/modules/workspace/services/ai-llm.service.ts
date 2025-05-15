import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { WebSocket, MessageEvent } from "ws";
import { performance } from "perf_hooks";

// ---- OpenAI
import { OpenAI } from "openai";
// ---- Payload
import { LlmPayload } from "../payloads/ai-llm.payload";


// ---- Enums
import { Models , ClaudeModelVersion , GoogleModelVersion , OpenAIModelVersion , DeepSeepModelVersion} from "@src/modules/common/enum/ai-services.enum";

/**
 * Service for managing LLM interactions with OpenAI API.
 */
@Injectable()
export class LlmService {
  /**
   * Establishes a connection to the OpenAI API
   * @param client WebSocket client for error reporting
   * @param authKey OpenAI API key
   * @returns OpenAI client instance or null if authentication fails
   */
  private async createOpenAIClient(
    client: WebSocket,
    authKey: string
  ): Promise<OpenAI | null> {
    try {
      const OpenAIclient = new OpenAI({
        apiKey: authKey,
      });
      return OpenAIclient;
    } catch (error: any) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message: "Invalid Authentication. Please add a valid OpenAI API key.",
          })
        );
      }
      return null;
    }
  }

  /**
   * Formats response metrics with timing information
   * @param data Response content
   * @param inputTokens Number of input tokens used
   * @param outputTokens Number of output tokens generated
   * @param totalTokens Total tokens used in the request
   * @param startTime Performance start time for timing calculation
   * @returns Formatted response object
   */
  private formatResponse(
    data: string | null,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    startTime: number
  ) {
    const endTime = performance.now();
    const timeTaken = Math.round(endTime - startTime);
    
    return {
      statusCode: 200,
      messages: data || "",
      inputTokens,
      outputTokens,
      totalTokens,
      timeTaken: `${timeTaken}ms`,
    };
  }

  /**
   * Processes LLM requests through OpenAI API
   */
  private async openaiLLMService(
    client: WebSocket,
    OpenAIclient: OpenAI | null,
    modelVersion: string,
    systemPrompt: string,
    userInput: string,
    streamResponse: boolean,
    jsonResponseFormat: boolean,
    temperature: number,
    presencePenalty: number,
    frequencePenalty: number,
    maxTokens: number,
  ): Promise<void> {
    // Return early if OpenAI client creation failed
    if (!OpenAIclient) return;

    const startTime = performance.now();
    
    // Message format for OpenAI API
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ];

    try {
      // For GPT-o1 and GPT-o1 Mini models, the response is generated without streaming and with limited parameters
      if (modelVersion === OpenAIModelVersion.GPT_o1 || modelVersion === OpenAIModelVersion.GPT_o1_Mini) {
        const response = await OpenAIclient.chat.completions.create({
          model: modelVersion,
          messages: messages,
        });
        
        const data = response.choices[0]?.message?.content || "";
        
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify(this.formatResponse(
              data,
              response.usage?.prompt_tokens || 0,
              response.usage?.completion_tokens || 0,
              response.usage?.total_tokens || 0,
              startTime
            ))
          );
        }
        return;
      }
      
      // Handle streaming response
      if (streamResponse === true) {
        const stream = await OpenAIclient.chat.completions.create({
          model: modelVersion,
          messages: messages,
          temperature: temperature,
          presence_penalty: presencePenalty,
          frequency_penalty: frequencePenalty,
          ...(maxTokens > 1 && { max_tokens: maxTokens }),
          ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
          stream: true,
          stream_options: { include_usage: true }
        });
        
        // Signal stream start
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              messages: "",
              stream_status: "start"
            })
          );
        }
        
        // Process stream chunks
        for await (const event of stream) {
          if (client.readyState !== WebSocket.OPEN) break;
          
          const choice = event.choices?.[0];
          
          // Send content chunk if it exists
          if (choice?.delta?.content) {
            client.send(
              JSON.stringify({
                messages: choice.delta.content,
                stream_status: "streaming"
              })
            );
          }
          
          // Send final usage information when available
          if (event?.usage) {
            const endTime = performance.now();
            const timeTaken = Math.round(endTime - startTime);

            client.send(
              JSON.stringify({
                statusCode: 200,
                messages: "",
                stream_status: "end",
                inputTokens: event.usage.prompt_tokens,
                outputTokens: event.usage.completion_tokens,
                totalTokens: event.usage.total_tokens,
                timeTaken: `${timeTaken}ms`,
              })
            );
          }
        }
      }
      // Handle non-streaming response
      else {
        const response = await OpenAIclient.chat.completions.create({
          model: modelVersion,
          messages: messages,
          temperature: temperature,
          presence_penalty: presencePenalty,
          frequency_penalty: frequencePenalty,
          ...(maxTokens > 1 && { max_tokens: maxTokens }),
          ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
        });
        
        const data = response.choices[0]?.message?.content || "";
        
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify(this.formatResponse(
              data,
              response.usage?.prompt_tokens || 0,
              response.usage?.completion_tokens || 0,
              response.usage?.total_tokens || 0,
              startTime
            ))
          );
        }
      }
    } catch (error: any) {
      if (client.readyState === WebSocket.OPEN) {
        console.log("error", error);
        client.send(
          JSON.stringify({
            statusCode: error?.status || 500,
            message: error?.error?.message || "Some Issue Occurred in Processing your Request. Please try again",
          })
        );
      }
    }
  }

  /**
   * Main service entry point to handle LLM requests via WebSocket
   * @param client WebSocket client
   */
  public async aiLlmService(client: WebSocket): Promise<void> {
    try {
      while (client.readyState === WebSocket.OPEN) {
        // Receive message from the client
        const message: string = await new Promise((resolve) => {
          const onMessage = (event: MessageEvent) => {
            resolve(event.data.toString("utf-8"));
            client.removeEventListener("message", onMessage);
          };
          client.addEventListener("message", onMessage);
        });

        // Parse incoming JSON data
        let parsedData: LlmPayload;
        try {
          parsedData = JSON.parse(message);
        } catch (err) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({ event: "error", message: "Invalid JSON format." })
            );
          }
          continue;
        }

        // Extract request parameters
        const {
          model,
          modelVersion,
          authKey = "",
          systemPrompt,
          userInput,
          streamResponse,
          jsonResponseFormat,
          temperature,
          presencePenalty,
          frequencePenalty,
          maxTokens
        } = parsedData;

        // Only support OpenAI model currently
        if (model === Models.OpenAI) {
          // Create OpenAI client
          const OpenAIclient = await this.createOpenAIClient(client, authKey);
          
          // Process the LLM request
          await this.openaiLLMService(
            client,
            OpenAIclient,
            modelVersion,
            systemPrompt,
            userInput,
            streamResponse,
            jsonResponseFormat,
            temperature,
            presencePenalty,
            frequencePenalty,
            maxTokens
          );
        } else {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                event: "error",
                message: "Unsupported model. Currently only 'openai' is supported."
              })
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in WebSocket loop:", error);
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message: "Some Issue Occurred in Processing your Request. Please try again",
          })
        );
      }
    }
  }
}