import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../../../../shared/domain/user-role';
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

export class AdminUpdateUserDto {
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
