import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxDate,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SELF_REGISTRATION_ROLES,
  UserRole,
} from '../../../../../shared/domain/user-role';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE =
  'Password must be 8-72 characters and include a letter and a number';

export class ProfileFieldsDto {
  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Obi' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @Matches(/^\+?[0-9 ()-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @ApiPropertyOptional({ example: '2014-05-20', description: 'Learners' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date())
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: 'yoruba' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  preferredLanguageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  profileImageUrl?: string;

  @ApiPropertyOptional({ description: 'Teachers' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  teachingExperienceYears?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['yoruba'],
    description: 'Teachers',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  languageSpecializations?: string[];
}

export class RegisterDto extends ProfileFieldsDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Passw0rd!' })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ enum: SELF_REGISTRATION_ROLES })
  @IsIn(SELF_REGISTRATION_ROLES, {
    message: `role must be one of: ${SELF_REGISTRATION_ROLES.join(', ')}`,
  })
  role!: UserRole;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset or invitation email' })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password, to confirm' })
  @IsString()
  @MaxLength(72)
  password!: string;
}
