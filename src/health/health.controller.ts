import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../shared/presentation/decorators/public.decorator';
import { ok } from '../shared/presentation/http/api-response';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  check() {
    return ok({
      status: 'ok',
      service: 'atupa-lms',
      timestamp: new Date().toISOString(),
    });
  }
}
