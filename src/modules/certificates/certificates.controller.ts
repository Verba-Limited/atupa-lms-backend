import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { ProgressService } from '../progress/progress.service';
import { CertificatesService } from './certificates.service';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly progressService: ProgressService,
  ) {}

  @Get('verify/:verificationCode')
  verify(@Param('verificationCode') verificationCode: string) {
    return this.certificatesService
      .verify(verificationCode)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService
      .listForUser(user.userId)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('issue')
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      learnerName: string;
      courseId: string;
      courseTitle: string;
      languageCode: string;
    },
  ) {
    await this.progressService.markCourseComplete(user.userId, body.courseId);
    return this.certificatesService
      .issue({
        userId: user.userId,
        learnerName: body.learnerName,
        courseId: body.courseId,
        courseTitle: body.courseTitle,
        languageCode: body.languageCode,
      })
      .then((data) => ok(data));
  }
}
