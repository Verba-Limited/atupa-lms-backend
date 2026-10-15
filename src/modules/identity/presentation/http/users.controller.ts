import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { UsersService } from '../../application/users.service';
import { ProfileFieldsDto } from './dto/auth.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() actor: Actor) {
    return ok(await this.users.getById(actor.userId));
  }

  @Patch('me')
  async updateMe(@CurrentUser() actor: Actor, @Body() dto: ProfileFieldsDto) {
    return ok(
      await this.users.updateProfile(actor.userId, dto),
      'Profile updated',
    );
  }
}
