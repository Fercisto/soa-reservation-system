import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from './admin.guard.js';
import { MenuResolver } from './menu.resolver.js';
import { RestaurantService } from './restaurant.service.js';
import { StaffResolver } from './staff.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [RestaurantService, AdminGuard, MenuResolver, StaffResolver],
})
export class RestaurantModule {}
