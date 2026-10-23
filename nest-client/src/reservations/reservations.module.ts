import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { ReservationsService } from './reservations.service.js';
import { ReservationsResolver } from './reservations.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [ReservationsService, ReservationsResolver],
  exports: [ReservationsService],
})
export class ReservationsModule {}