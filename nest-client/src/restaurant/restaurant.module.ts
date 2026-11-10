import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { LaravelClient } from '../common/laravel.client.js';
import { MenuResolver } from './menu.resolver.js';
import { RestaurantAccess } from './restaurant-access.js';
import { RestaurantService } from './restaurant.service.js';
import { StaffResolver } from './staff.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [LaravelClient, RestaurantService, RestaurantAccess, MenuResolver, StaffResolver],
})
export class RestaurantModule {}
