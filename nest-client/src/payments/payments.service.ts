import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreatePaymentInput } from './dto/payment.inputs.js';

export interface PaymentFilters {
  status?: string;
  reservation_id?: number;
}

@Injectable()
export class PaymentsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll(filters: PaymentFilters, authorization: string) {
    return this.request('get', '/payments', authorization, undefined, filters);
  }

  async findOne(id: string, authorization: string) {
    return this.request('get', `/payments/${id}`, authorization);
  }

  async create(input: CreatePaymentInput, authorization: string) {
    return this.request('post', '/payments', authorization, input);
  }

  async verify(id: string, authorization: string) {
    return this.request('post', `/payments/${id}/verify`, authorization, {});
  }

  private async request(
    method: 'get' | 'post',
    path: string,
    authorization: string,
    body?: unknown,
    params?: object,
  ) {
    try {
      const config = { headers: { Authorization: authorization }, params };
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
