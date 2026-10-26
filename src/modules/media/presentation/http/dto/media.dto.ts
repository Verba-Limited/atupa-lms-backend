import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { MediaKind, MediaPurpose } from '../../../domain/media-asset.entity';

export class RequestUploadDto {
  @ApiProperty({ enum: MediaKind })
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @ApiProperty({ enum: MediaPurpose })
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;
}

export class ConfirmUploadDto extends RequestUploadDto {
  @ApiProperty({ description: 'public_id returned by Cloudinary' })
  @IsString()
  @MaxLength(300)
  publicId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalName?: string;

  @ApiPropertyOptional({
    description: '`duration` from the Cloudinary upload response (audio/video)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24 * 3600)
  durationSeconds?: number;
}

export class PlaybackLookupDto {
  @ApiProperty({
    type: [String],
    description: 'Media URLs from lessons, vocabulary, quizzes or activities',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUrl({ require_protocol: true, require_tld: false }, { each: true })
  urls!: string[];
}

export class ServerUploadDto {
  @ApiProperty({ enum: MediaPurpose })
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;
}

export class ListMediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MediaKind })
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;

  @ApiPropertyOptional({
    description: "Content creators/admins: list everyone's media",
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}
