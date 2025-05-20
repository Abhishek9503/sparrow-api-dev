import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class TeamsCountLimit {
  @IsString()
  @IsNotEmpty()
  area: string;

  @IsNotEmpty()
  value: number;
}

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

export class Limits {
  ownedHub: TeamsCountLimit;
}
