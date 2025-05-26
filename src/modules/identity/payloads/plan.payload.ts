import { Limits } from "@src/modules/common/models/plan.model";
import {
  IsBoolean,
  IsMongoId,
  isNotEmpty,
  IsNotEmpty,
  isObject,
  IsOptional,
  IsString,
} from "class-validator";
import { ObjectId } from "mongodb";

export class CreateOrUpdatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;


  @IsBoolean()
  @isNotEmpty()
  active: boolean;

  @isObject()
  @isNotEmpty()
  limits: Limits;
}

export class PlanDto {
  @IsMongoId()
  @isNotEmpty()
  id: ObjectId;

  @IsString()
  @isNotEmpty()
  name: string;
}
