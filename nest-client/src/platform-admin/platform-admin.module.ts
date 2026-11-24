import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { LaravelClient } from '../common/laravel.client.js';
import { PlatformAdminResolver } from './platform-admin.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [LaravelClient, PlatformAdminResolver],
})
export class PlatformAdminModule {}
