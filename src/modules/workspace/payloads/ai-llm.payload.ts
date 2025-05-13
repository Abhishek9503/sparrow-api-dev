import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class LlmPayload {
  /**
   * The model name to be used for the prompt.
   */
  @IsString()
  @ApiProperty({ required: true, example: "OpenAI or Anthropic" })
  @IsOptional()
  model: string;

  /**
   * The model version.
   */
  @IsString()
  @ApiProperty({ required: true, example: "gpt-4o or deepseek v3" })
  @IsOptional()
  modelVersion: string;

  /**
   * Auth key.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "Auth Token" })
  authKey: string;

  /**
   * The System prompt to be used for the model.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "System Prompt" })
  systemPrompt: string;

  /** 
   * User Input.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "User Input" })
  userInput: string;

  /**
   * Stream Response.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "true or false" })
  streamResponse: boolean;

  /**
   * JSON Response Format.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "true or false" })
  jsonResponseFormat: boolean;

  /**
   * Temperature.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "0.0 to 1.0" })
  temperature: number;

  /**
   * Presence Penalty.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "0.0 to 1.0" })
  presencePenalty: number;

  /**
   * Frequence Penalty.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "0.0 to 1.0" })
  frequencePenalty: number;

  /**
   * Max Tokens.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: "-1 to 4096" })
  maxTokens: number;

}