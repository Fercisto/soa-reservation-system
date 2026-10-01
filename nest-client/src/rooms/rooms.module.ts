import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}