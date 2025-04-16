import { IsNotEmpty, IsString, IsArray, IsDateString } from "class-validator";

export class UnregisteredUser {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];

  @IsDateString()
  createdAt: Date;
}
