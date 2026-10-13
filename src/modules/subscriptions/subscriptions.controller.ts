import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  plans() {
    return ok(this.subscriptionsService.listPlans());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService
      .getOrCreate(user.userId)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { planCode: 'free' | 'individual_premium' | 'school' },
  ) {
    return this.subscriptionsService
      .checkout({
        userId: user.userId,
        email: user.email,
        planCode: body.planCode,
      })
      .then((data) => ok(data));
  }

  @Post('webhooks/paystack')
  webhook(
    @Body() body: { reference: string; planCode: 'individual_premium' | 'school' },
    @Query('signature') signature?: string,
  ) {
    return this.subscriptionsService
      .confirmPayment(body.reference, body.planCode)
      .then((data) => ok(data, 'Payment confirmed'));
  }
}
