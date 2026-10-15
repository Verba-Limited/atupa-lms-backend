import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';

export class ScanDto {
  @ApiProperty({ example: 'YOR-LION', description: 'Code from the scanned QR' })
  @IsString()
  @Length(2, 60)
  code!: string;
}

export class ChallengeAnswerDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  answer!: string;
}

export class GameSessionDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  scorePercent!: number;

  @ApiProperty({ description: 'Seconds played' })
  @IsInt()
  @Min(0)
  @Max(4 * 3600)
  durationSeconds!: number;
}

export class PlaysQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['scan', 'challenge', 'game'] })
  @IsOptional()
  @IsIn(['scan', 'challenge', 'game'])
  kind?: 'scan' | 'challenge' | 'game';
}

export class CardChallengeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 500)
  prompt!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  choices?: string[];

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  answer!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;
}

export class GameCardDto {
  @ApiProperty({ example: 'YOR-LION' })
  @Matches(/^[A-Za-z0-9-]{2,60}$/, {
    message: 'code may contain letters, digits and dashes',
  })
  code!: string;

  @ApiProperty({ example: 'lion' })
  @IsString()
  @Length(1, 60)
  conceptKey!: string;

  @ApiProperty({ example: 'yoruba' })
  @IsString()
  @MaxLength(30)
  languageCode!: string;

  @ApiProperty({ example: 'Kìnnìún (Lion)' })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional({ type: CardChallengeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CardChallengeDto)
  challenge?: CardChallengeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateGameCardDto extends PartialType(GameCardDto) {}

export class CardsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conceptKey?: string;
}
