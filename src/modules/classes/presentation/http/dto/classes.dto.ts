import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';

export class CreateClassDto {
  @ApiProperty({ example: 'Primary 5 Yoruba' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'yoruba' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional({
    description: 'Required for school admins / super admins',
  })
  @IsOptional()
  @IsMongoId()
  teacherUserId?: string;

  @ApiPropertyOptional({ description: 'Super admins only' })
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}

export class UpdateClassDto extends PartialType(
  PickType(CreateClassDto, ['name', 'description', 'languageCode'] as const),
) {}

export class AddStudentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  studentIds!: string[];
}

export class SetTeacherDto {
  @ApiProperty()
  @IsMongoId()
  teacherUserId!: string;
}

export class AnnouncementDto {
  @ApiProperty()
  @IsString()
  @Length(2, 140)
  title!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  body!: string;
}

export class JoinClassDto {
  @ApiProperty()
  @IsString()
  @Length(8, 8)
  code!: string;
}

export class ClassesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Super admins: filter by school' })
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}
