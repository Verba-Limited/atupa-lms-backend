import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { SubscriptionsService } from '../../application/subscriptions.service';
import { CheckoutDto, PaymentsQueryDto } from './dto/subscriptions.dto';

@ApiTags('Subscriptions & payments')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('plans')
  plans() {
    return ok(this.subscriptions.listPlans());
  }

  @ApiBearerAuth()
  @Get('mine')
  async mine(@CurrentUser() actor: Actor) {
    return ok(await this.subscriptions.getMine(actor));
  }

  /** Starts a Paystack checkout; redirect the user to `authorizationUrl`. */
  @ApiBearerAuth()
  @Post('checkout')
  async checkout(@CurrentUser() actor: Actor, @Body() dto: CheckoutDto) {
    return ok(
      await this.subscriptions.checkout(actor, dto.planCode),
      'Checkout started',
    );
  }

  /** Call after Paystack redirects back to the frontend callback URL. */
  @ApiBearerAuth()
  @Get('payments/:reference/verify')
  async verify(
    @CurrentUser() actor: Actor,
    @Param('reference') reference: string,
  ) {
    return ok(await this.subscriptions.verifyForActor(actor, reference));
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Get('payments')
  async payments(@Query() query: PaymentsQueryDto) {
    const { status, ownerId } = query;
    return ok(
      await this.subscriptions.listPayments({ status, ownerId }, pageOf(query)),
    );
  }

  /** Paystack webhook. Verified by HMAC signature over the raw body. */
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @HttpCode(200)
  @Post('webhooks/paystack')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    await this.subscriptions.handleWebhook(req.rawBody, signature);
    return ok({ received: true });
  }
}
