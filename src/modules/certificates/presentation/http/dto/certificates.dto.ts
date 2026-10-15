import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';

export class RevokeCertificateDto {
  @ApiProperty()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CertificatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @ApiPropertyOptional({ enum: ['valid', 'revoked'] })
  @IsOptional()
  @IsIn(['valid', 'revoked'])
  status?: 'valid' | 'revoked';
}
