import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { CertificatesService } from '../../application/certificates.service';
import {
  CertificatesQueryDto,
  RevokeCertificateDto,
} from './dto/certificates.dto';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  /** Public verification page data (scan the QR on a certificate). */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('verify/:verificationCode')
  async verify(@Param('verificationCode') code: string) {
    return ok(await this.certificates.verify(code));
  }

  @ApiBearerAuth()
  @Get('mine')
  async mine(@CurrentUser() actor: Actor) {
    return ok(await this.certificates.listMine(actor));
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  async list(@Query() query: CertificatesQueryDto) {
    const { courseId, status } = query;
    return ok(
      await this.certificates.list({ courseId, status }, pageOf(query)),
    );
  }

  @ApiBearerAuth()
  @Get(':id')
  async get(@CurrentUser() actor: Actor, @IdParam('id') id: string) {
    return ok(await this.certificates.getForActor(actor, id));
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post(':id/revoke')
  async revoke(@IdParam('id') id: string, @Body() dto: RevokeCertificateDto) {
    return ok(
      await this.certificates.revoke(id, dto.reason),
      'Certificate revoked',
    );
  }
}
