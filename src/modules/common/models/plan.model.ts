import {
  IsBoolean,
  IsDateString,
  IsEnum,
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
  AI = "ai"
}
export class LimitData { 
  @IsEnum(LimmitArea)
  @IsNotEmpty()
  area: LimmitArea;

  @IsNotEmpty()
  value: number;
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
  active?: boolean;

  @IsOptional()
  limits?: Limits;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}


