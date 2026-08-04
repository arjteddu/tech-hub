import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { PresignedUploadDto } from "shared";
import { PresignUploadDto } from "./dto/presign-upload.dto";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class MediaService {
  private client(): S3Client {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new ServiceUnavailableException(
        "Media storage isn't configured — set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL",
      );
    }
    // R2 is S3-compatible: same SDK, different endpoint, region is a
    // required-but-unused placeholder for R2's API.
    return new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }

  async presignUpload(dto: PresignUploadDto): Promise<PresignedUploadDto> {
    const bucket = process.env.R2_BUCKET;
    const publicUrlBase = process.env.R2_PUBLIC_URL;
    if (!bucket || !publicUrlBase) {
      throw new ServiceUnavailableException(
        "Media storage isn't configured — set R2_BUCKET and R2_PUBLIC_URL",
      );
    }

    const key = `products/${randomUUID()}-${dto.filename}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: dto.contentType });
    const uploadUrl = await getSignedUrl(this.client(), command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return { uploadUrl, publicUrl: `${publicUrlBase.replace(/\/$/, "")}/${key}` };
  }
}
