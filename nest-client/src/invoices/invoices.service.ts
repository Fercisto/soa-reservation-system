import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateInvoiceInput } from './dto/invoice.inputs.js';

export interface InvoiceFilters {
  status?: string;
  reservation_id?: number;
}

@Injectable()
export class InvoicesService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll(filters: InvoiceFilters, authorization: string) {
    return this.request('get', '/invoices', authorization, undefined, filters);
  }

  async findOne(id: string, authorization: string) {
    return this.request('get', `/invoices/${id}`, authorization);
  }

  async create(input: CreateInvoiceInput, authorization: string) {
    return this.request('post', '/invoices', authorization, input);
  }

  async cancel(id: string, authorization: string) {
    return this.request('post', `/invoices/${id}/cancel`, authorization, {});
  }

  async adminSummary(authorization: string) {
    return this.request('get', '/admin/summary', authorization);
  }

  private async request(
    method: 'get' | 'post',
    path: string,
    authorization: string,
    body?: unknown,
    params?: object,
  ) {
    try {
      // Stamping with the SAT can take several seconds.
      const config = {
        headers: { Authorization: authorization },
        params,
        timeout: 60000,
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
