import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { MediaService } from "./media.service";
import { PresignUploadDto } from "./dto/presign-upload.dto";

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // Returns a short-lived presigned PUT URL — the browser uploads the
  // file directly to R2, the file bytes never pass through this API.
  @Post("presign")
  presign(@Body() dto: PresignUploadDto) {
    return this.media.presignUpload(dto);
  }
}
