import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { USER_REPOSITORY } from '../../common/tokens/repository.tokens';
import { UsersRepository } from './users.repository';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: UsersRepository },
  ],
  exports: [UsersService, USER_REPOSITORY, MongooseModule],
})
export class UsersModule {}
