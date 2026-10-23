import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthResolver } from './auth.resolver.js';

@Module({
  imports: [HttpModule],
  providers: [AuthService, AuthGuard, AuthResolver],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}