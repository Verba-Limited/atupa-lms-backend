import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { MediaPurpose, MediaService } from '../../../media';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../application/users.service';
import { SubmitVerificationDto } from './dto/admin-users.dto';
import { DeleteAccountDto, ProfileFieldsDto } from './dto/auth.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly media: MediaService,
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

  /**
   * Teachers send ID or certificate scans (uploaded with
   * purpose=verification). ATUPA reviews them and verifies the account.
   */
  @Roles(UserRole.TEACHER)
  @Post('me/verification')
  async submitVerification(
    @CurrentUser() actor: Actor,
    @Body() dto: SubmitVerificationDto,
  ) {
    const assets = await this.media.requireOwnUploads(
      actor,
      dto.documents.map((d) => d.mediaId),
      MediaPurpose.VERIFICATION,
    );
    return ok(
      await this.users.submitVerification(
        actor.userId,
        dto.documents.map((d, i) => ({
          mediaId: d.mediaId,
          url: assets[i].url,
          label: d.label,
        })),
        dto.note,
      ),
      'Documents submitted. ATUPA will review them shortly.',
    );
  }

  /** Deletes (anonymises) my account. Requires my current password. */
  @Delete('me')
  async deleteMe(@CurrentUser() actor: Actor, @Body() dto: DeleteAccountDto) {
    await this.auth.deleteOwnAccount(actor.userId, dto.password);
    return ok(null, 'Account deleted');
  }
}
