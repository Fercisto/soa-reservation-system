import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsResolver } from './payments.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [PaymentsService, PaymentsResolver],
  exports: [PaymentsService],
})
export class PaymentsModule {}
