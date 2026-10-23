import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { RoomsService } from './rooms.service.js';
import { RoomsResolver } from './rooms.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [RoomsService, RoomsResolver],
  exports: [RoomsService],
})
export class RoomsModule {}