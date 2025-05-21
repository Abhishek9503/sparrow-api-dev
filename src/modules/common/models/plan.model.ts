import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export enum LimmitArea {
  USER = "user",
  HUB = "hub",
  WORKSPACE = "workspace",
  TESTFLOW = "testflow",
  ENVIRONMENT = "environment",
  COLLECTION = "collection",
  AI = "ai",
}

export class Limits {}

export class Plan {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsNotEmpty()
  active?: boolean;

  @IsNotEmpty()
  limits?: Limits;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  createdBy?: string;

  @IsString()
  updatedBy?: string;
}
