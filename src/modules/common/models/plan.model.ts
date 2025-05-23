import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
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

export class Limits {
  workspacesPerHub: WorkspaceLimit;
  testflowPerWorkspace: TestflowLimit;
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
