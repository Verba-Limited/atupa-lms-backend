import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../application/users.service';
import { DeleteAccountDto, ProfileFieldsDto } from './dto/auth.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

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

  /** Deletes (anonymises) my account. Requires my current password. */
  @Delete('me')
  async deleteMe(@CurrentUser() actor: Actor, @Body() dto: DeleteAccountDto) {
    await this.auth.deleteOwnAccount(actor.userId, dto.password);
    return ok(null, 'Account deleted');
  }
}
