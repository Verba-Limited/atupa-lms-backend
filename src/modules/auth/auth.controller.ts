import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/utils/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto).then((data) => ok(data, 'Registered'));
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto).then((data) => ok(data, 'Logged in'));
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService
      .refresh(refreshToken)
      .then((data) => ok(data, 'Token refreshed'));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService
      .logout(user.userId)
      .then(() => ok(null, 'Logged out'));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.usersService.getByIdOrThrow(user.userId);
    return ok({
      id: String(account._id),
      email: account.email,
      role: account.role,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone,
      schoolId: account.schoolId,
    });
  }
}
