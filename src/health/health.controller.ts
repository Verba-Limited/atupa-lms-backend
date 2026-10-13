import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ok } from '../common/utils/api-response';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return ok({
      status: 'ok',
      service: 'atupa-lms',
      timestamp: new Date().toISOString(),
    });
  }
}
