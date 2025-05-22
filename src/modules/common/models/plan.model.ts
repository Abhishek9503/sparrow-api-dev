import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export enum LimitArea {
  USER = "user",
  HUB = "hub",
  WORKSPACE = "workspace",
  TESTFLOW = "testflow",
  ENVIRONMENT = "environment",
  COLLECTION = "collection",
  AI = "ai",
}

export class WorkspaceLimit {
  area: LimitArea.WORKSPACE;

  @IsBoolean()
  @IsNotEmpty()
  value: boolean;
}

export class Limits {
  workspacesPerHub: WorkspaceLimit;
}

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
