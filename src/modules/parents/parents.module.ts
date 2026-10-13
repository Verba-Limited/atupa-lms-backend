import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { UsersModule } from '../users/users.module';
import { ParentsController } from './parents.controller';

@Module({
  imports: [UsersModule, ProgressModule],
  controllers: [ParentsController],
})
export class ParentsModule {}
