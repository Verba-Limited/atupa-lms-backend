import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxDate,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '../../../../../shared/domain/user-role';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';

const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export class SchoolProfileDto {
  @ApiProperty({ example: 'Lagos Model College' })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE, { message: 'phone must be valid' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  declaredStudentCount?: number;
}

export class SchoolAdminAccountDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, {
    message:
      'Password must be 8-72 characters and include a letter and a number',
  })
  password!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 60)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE, { message: 'phone must be valid' })
  phone?: string;
}

export class RegisterSchoolDto extends SchoolProfileDto {
  @ApiProperty({ type: SchoolAdminAccountDto })
  @ValidateNested()
  @Type(() => SchoolAdminAccountDto)
  admin!: SchoolAdminAccountDto;
}

export class SchoolSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  leaderboardsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLearnerNamesOnLeaderboards?: boolean;
}

export class UpdateSchoolDto extends PartialType(SchoolProfileDto) {
  @ApiPropertyOptional({ type: SchoolSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolSettingsDto)
  settings?: SchoolSettingsDto;

  @ApiPropertyOptional({ description: 'Super admin only' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddMemberDto {
  @ApiProperty({
    enum: [UserRole.TEACHER, UserRole.LEARNER, UserRole.SCHOOL_ADMIN],
  })
  @IsIn([UserRole.TEACHER, UserRole.LEARNER, UserRole.SCHOOL_ADMIN])
  role!: UserRole;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE, { message: 'phone must be valid' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Learners' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date())
  dateOfBirth?: Date;

  @ApiPropertyOptional({ type: [String], description: 'Teachers' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languageSpecializations?: string[];
}

export class MembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class SchoolsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class JoinSchoolDto {
  @ApiProperty()
  @IsString()
  @Length(8, 8)
  joinCode!: string;
}
