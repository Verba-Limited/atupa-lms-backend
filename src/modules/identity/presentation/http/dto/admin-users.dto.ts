import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '../../../../../shared/domain/user-role';
import { VerificationStatus } from '../../../domain/user.entity';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { ProfileFieldsDto } from './auth.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class InviteUserDto extends ProfileFieldsDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}

export class AdminUpdateUserDto extends ProfileFieldsDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsMongoId()
  schoolId?: string | null;
}

export class VerificationDocumentDto {
  @ApiProperty({
    description: 'Id from a media upload with purpose=verification',
  })
  @IsMongoId()
  mediaId!: string;

  @ApiProperty({ example: 'Teacher registration certificate' })
  @IsString()
  @Length(2, 120)
  label!: string;
}

export class SubmitVerificationDto {
  @ApiProperty({ type: [VerificationDocumentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents!: VerificationDocumentDto[];

  @ApiPropertyOptional({ example: 'TRCN number 12345' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class VerificationDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;
}
