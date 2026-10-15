import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './application/auth.service';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_ISSUER } from './application/ports/token-issuer.port';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { UsersService } from './application/users.service';
import { SuperAdminBootstrap } from './infrastructure/bootstrap/super-admin.bootstrap';
import {
  UserRecord,
  UserSchema,
} from './infrastructure/persistence/user.schema';
import { UserMongoRepository } from './infrastructure/persistence/user.mongo-repository';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer';
import { AdminUsersController } from './presentation/http/admin-users.controller';
import { AuthController } from './presentation/http/auth.controller';
import { UsersController } from './presentation/http/users.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    MongooseModule.forFeature([{ name: UserRecord.name, schema: UserSchema }]),
  ],
  controllers: [AuthController, UsersController, AdminUsersController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    SuperAdminBootstrap,
    { provide: USER_REPOSITORY, useClass: UserMongoRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
  ],
  exports: [UsersService, AuthService],
})
export class IdentityModule {}
