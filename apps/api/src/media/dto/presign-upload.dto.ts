import { IsIn, IsString, Matches } from "class-validator";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export class PresignUploadDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: "filename must be a plain file name, no path segments" })
  filename!: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_CONTENT_TYPES)[number];
}
