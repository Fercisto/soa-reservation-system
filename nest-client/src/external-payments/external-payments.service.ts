import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateExternalPaymentInput } from './external-payment.model.js';

export interface ExternalPaymentFilters {
  reference?: string;
  status?: string;
}

@Injectable()
export class ExternalPaymentsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll(filters: ExternalPaymentFilters, apiKey: string) {
    return this.request('get', '/v1/payments', apiKey, undefined, filters);
  }

  async findOne(id: string, apiKey: string) {
    return this.request('get', `/v1/payments/${id}`, apiKey);
  }

  async create(input: CreateExternalPaymentInput, apiKey: string) {
    return this.request('post', '/v1/payments', apiKey, input);
  }

  async verify(id: string, apiKey: string) {
    return this.request('post', `/v1/payments/${id}/verify`, apiKey, {});
  }

  async cancel(id: string, apiKey: string) {
    return this.request('post', `/v1/payments/${id}/cancel`, apiKey, {});
  }

  async refund(id: string, apiKey: string) {
    return this.request('post', `/v1/payments/${id}/refund`, apiKey, {});
  }

  private async request(
    method: 'get' | 'post',
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
          : this.httpService.post(url, body, config),
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
