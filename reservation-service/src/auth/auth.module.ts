import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [HttpModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}