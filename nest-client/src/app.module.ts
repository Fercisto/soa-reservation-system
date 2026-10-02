import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { RoomsModule } from './rooms/rooms.module.js';

@Module({
  imports: [AuthModule, RoomsModule, ReservationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}