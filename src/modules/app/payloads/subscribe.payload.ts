import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class subscribePayload {
  @ApiProperty({
    example: "demo@gmail.com",
  })
  @IsString()
  @IsNotEmpty()
  email: string;
}
