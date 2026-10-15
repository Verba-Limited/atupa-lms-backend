import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsObject } from 'class-validator';

export class SubmitActivityDto {
  @ApiProperty({
    description:
      'Learner response: a string, an array (ordered for word arrangement) or a { left: right } map',
  })
  @IsDefined()
  response!: unknown;
}

export class SubmitQuizDto {
  @ApiProperty({
    description: 'Answers keyed by question id',
    example: { 'q-1': 'Ẹ kú àárọ̀', 'q-2': 'true' },
  })
  @IsObject()
  answers!: Record<string, unknown>;
}
