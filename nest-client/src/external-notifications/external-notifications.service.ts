import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { SendExternalNotificationInput } from './external-notification.model.js';

export interface ExternalNotificationFilters {
  recipient: string;
  unread?: boolean | string;
  limit?: number | string;
}

@Injectable()
export class ExternalNotificationsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async send(input: SendExternalNotificationInput, apiKey: string) {
    return this.request('post', '/v1/notifications', apiKey, input);
  }

  async findAll(filters: ExternalNotificationFilters, apiKey: string) {
    const params = {
      recipient: filters.recipient,
      ...(filters.unread === true || filters.unread === 'true' || filters.unread === '1'
        ? { unread: 1 }
        : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    };
    return this.request('get', '/v1/notifications', apiKey, undefined, params);
  }

  async findOne(id: string, apiKey: string) {
    return this.request('get', `/v1/notifications/${id}`, apiKey);
  }

  async markAsRead(id: string, apiKey: string) {
    return this.request('patch', `/v1/notifications/${id}/read`, apiKey, {});
  }

  async markAllAsRead(recipient: string, apiKey: string) {
    return this.request('patch', '/v1/notifications/read-all', apiKey, {
      recipient,
    });
  }

  private async request(
    method: 'get' | 'post' | 'patch',
    path: string,
    apiKey: string,
    body?: unknown,
    params?: object,
  ) {
    try {
      const config = {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        params,
      };
      const url = `${this.laravelApiUrl}${path}`;
      const response = await firstValueFrom(
        method === 'get'
          ? this.httpService.get(url, config)
          : method === 'post'
            ? this.httpService.post(url, body, config)
            : this.httpService.patch(url, body, config),
      );

      return response.data;
    } catch (error: any) {
      if (error?.response) {
        throw new HttpException(
          error.response.data || 'Laravel API error',
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Laravel API is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
