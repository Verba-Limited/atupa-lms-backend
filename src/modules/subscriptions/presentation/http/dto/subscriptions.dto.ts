import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import type {
  PaymentStatus,
  PlanCode,
} from '../../../domain/subscription.entities';

export class CheckoutDto {
  @ApiProperty({ enum: ['individual_premium', 'school'] })
  @IsIn(['individual_premium', 'school'])
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
}
