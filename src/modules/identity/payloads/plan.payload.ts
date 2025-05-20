import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { ObjectId } from "mongodb";

export class TeamsCountLimit {
  @IsString()
  @IsNotEmpty()
  area: string;

  @IsNotEmpty()
  value: number;
}

export class Limits {
  noOfOwnedHub: TeamsCountLimit;
}
export class CreateOrUpdatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsBoolean()
  active?: boolean;

  @IsOptional()
  limits?: Limits;

}

export class PlanDto {
  @IsMongoId()
  id: ObjectId;

  @IsString()
  name: string;
}
