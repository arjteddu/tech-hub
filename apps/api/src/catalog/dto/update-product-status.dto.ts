import { IsIn } from "class-validator";

export class UpdateProductStatusDto {
  @IsIn(["DRAFT", "ACTIVE", "ARCHIVED"])
  status!: "DRAFT" | "ACTIVE" | "ARCHIVED";
}
