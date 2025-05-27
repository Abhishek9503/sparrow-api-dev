import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
} from "class-validator";

export enum LimitArea {
  USER = "user",
  HUB = "hub",
  WORKSPACE = "workspace",
  TESTFLOW = "testflow",
  BLOCK = "block",
  ENVIRONMENT = "environment",
  COLLECTION = "collection",
  AI = "ai",
}

export class WorkspaceLimit {
  area: LimitArea.WORKSPACE;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class TestflowLimit {
  area: LimitArea.TESTFLOW;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class BlocksPerTestflow {
  area: LimitArea.BLOCK;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class Limits {
  workspacesPerHub: WorkspaceLimit;
  testflowPerWorkspace: TestflowLimit;
  blocksPerTestflow: BlocksPerTestflow;
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
  @IsObject()
  limits: Limits;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  createdBy: string;

  @IsString()
  updatedBy: string;
}
