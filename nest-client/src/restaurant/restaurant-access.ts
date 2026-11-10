import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { LaravelClient } from '../common/laravel.client.js';

interface RestaurantCredentials {
  enabled: boolean;
  api_key: string | null;
  features: string[];
}

/**
 * Each hotel has its own API key in the restaurant system, so it only sees its own
 * menu and staff. Laravel keeps the key and gives it to Nest through an internal route.
 */
@Injectable()
export class RestaurantAccess {
  constructor(private readonly laravel: LaravelClient) {}

  /**
   * Key of the admin's hotel, if its plan includes the module (restaurant: Gold, staff: Silver).
   */
  async keyForAdmin(user: any, feature: 'restaurant' | 'staff'): Promise<string> {
    if (user?.role !== 'admin' || !user.hotel) {
      throw new ForbiddenException('Only hotel administrators can manage this resource');
    }

    if (!user.hotel.features?.includes(feature)) {
      throw new ForbiddenException(
        'Your plan does not include this module. Upgrade your plan to use it.',
      );
    }

    const credentials = await this.credentials(user.hotel.slug);

    if (!credentials.api_key) {
      throw new ServiceUnavailableException(
        'Add the API key of the restaurant system in your hotel settings.',
      );
    }

    return credentials.api_key;
  }

  /**
   * Key to show a hotel's menu to its guests.
   */
  async keyForGuests(hotelSlug: string): Promise<string> {
    const credentials = await this.credentials(hotelSlug);

    if (!credentials.enabled || !credentials.api_key) {
      throw new NotFoundException('This hotel has no restaurant menu');
    }

    return credentials.api_key;
  }

  private credentials(hotelSlug: string): Promise<RestaurantCredentials> {
    return this.laravel.request(
      'get',
      `/internal/hotels/${encodeURIComponent(hotelSlug)}/restaurant`,
      { headers: { 'X-Gateway-Secret': process.env.GATEWAY_SECRET ?? '' } },
    );
  }
}
