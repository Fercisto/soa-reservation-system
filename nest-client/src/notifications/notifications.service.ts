import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll(
    filters: { unread?: boolean; limit?: number },
    authorization: string,
  ) {
    const params = {
      ...(filters.unread ? { unread: 1 } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    };
    return this.request('get', '/notifications', authorization, params);
  }

  async markAsRead(id: string, authorization: string) {
    return this.request('patch', `/notifications/${id}/read`, authorization);
  }

  async markAllAsRead(authorization: string) {
    return this.request('patch', '/notifications/read-all', authorization);
  }

  private async request(
    method: 'get' | 'patch',
    path: string,
    authorization: string,
    params?: object,
  ) {
    try {
      const config = { headers: { Authorization: authorization }, params };
      const url = `${this.laravelApiUrl}${path}`;
      const response = await firstValueFrom(
        method === 'get'
          ? this.httpService.get(url, config)
          : this.httpService.patch(url, {}, config),
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
