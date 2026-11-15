import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import {
  MAX_MANUAL_GRANT_DAYS,
  type OwnerType,
  type PaymentStatus,
  type PlanCode,
} from '../../../domain/subscription.entities';

const PLAN_CODE = /^[a-z][a-z0-9_]{1,39}$/;

export class CheckoutDto {
  @ApiProperty({ example: 'individual_premium' })
  @Matches(PLAN_CODE, { message: 'planCode is not a valid plan code' })
  planCode!: PlanCode;
}

export class PaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'success', 'failed'] })
  @IsOptional()
  @IsIn(['pending', 'success', 'failed'])
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @ApiPropertyOptional({ example: 'individual_premium' })
  @IsOptional()
  @Matches(PLAN_CODE)
  planCode?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class PlanDto {
  @ApiProperty({ example: 'family_premium' })
  @Matches(PLAN_CODE, {
    message: 'code must be lowercase letters, digits or _ (2-40 chars)',
  })
  code!: string;

  @ApiProperty({ example: 'Family Premium' })
  @IsString()
  @Length(2, 60)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 2, description: '0 = free; higher unlocks more' })
  @IsInt()
  @Min(0)
  @Max(20)
  tier!: number;

  @ApiProperty({ example: 800000, description: 'Price per period in kobo' })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  amountKobo!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(366)
  periodDays!: number;

  @ApiProperty({ enum: ['user', 'school'] })
  @IsIn(['user', 'school'])
  ownerType!: OwnerType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features: string[] = [];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdatePlanDto extends PartialType(PlanDto) {}

export class SubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['user', 'school'] })
  @IsOptional()
  @IsIn(['user', 'school'])
  ownerType?: OwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PLAN_CODE)
  planCode?: string;

  @ApiPropertyOptional({ enum: ['active', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: 'active' | 'cancelled';

  @ApiPropertyOptional({ description: 'Only plans whose period has not ended' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;
}

export class GrantSubscriptionDto {
  @ApiProperty({ enum: ['user', 'school'] })
  @IsIn(['user', 'school'])
  ownerType!: OwnerType;

  @ApiProperty({ description: 'User id or school id' })
  @IsMongoId()
  ownerId!: string;

  @ApiProperty({ example: 'individual_premium' })
  @Matches(PLAN_CODE)
  planCode!: PlanCode;

  @ApiProperty({ example: 30, maximum: MAX_MANUAL_GRANT_DAYS })
  @IsInt()
  @Min(1)
  @Max(MAX_MANUAL_GRANT_DAYS)
  days!: number;

  @ApiProperty({ example: 'Refund for failed payment ATUPA-123' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CancelSubscriptionDto {
  @ApiProperty({ enum: ['user', 'school'] })
  @IsIn(['user', 'school'])
  ownerType!: OwnerType;

  @ApiProperty()
  @IsMongoId()
  ownerId!: string;

  @ApiProperty({ example: 'Customer asked to stop' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}
