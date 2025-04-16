import { IsEmail, IsOptional, IsArray, IsString } from "class-validator";

export class CreateNonUser {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}

export class UpdateNonUser {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}
