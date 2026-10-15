import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../application/users.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const AUTH_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return ok(await this.auth.register(dto), 'Registered');
  }

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return ok(await this.auth.login(dto.email, dto.password), 'Logged in');
  }

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return ok(await this.auth.refresh(dto.refreshToken), 'Token refreshed');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/forgot')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    return ok(null, 'If that email is registered, a reset link has been sent');
  }

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(200)
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return ok(
      await this.auth.resetPassword(dto.token, dto.newPassword),
      'Password updated',
    );
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('password/change')
  async changePassword(
    @CurrentUser() actor: Actor,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(
      actor.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return ok(null, 'Password changed. Please log in again on other devices.');
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() actor: Actor) {
    await this.auth.logout(actor.userId);
    return ok(null, 'Logged out');
  }

  @ApiBearerAuth()
  @Get('profile')
  async profile(@CurrentUser() actor: Actor) {
    return ok(await this.users.getById(actor.userId));
  }
}
