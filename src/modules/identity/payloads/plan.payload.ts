import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";


export class Limits {
  @IsString()
  @IsNotEmpty()
  area: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsNotEmpty()
  type: string;
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

  @IsArray()
  @IsOptional()
  limits?: Limits[];
}