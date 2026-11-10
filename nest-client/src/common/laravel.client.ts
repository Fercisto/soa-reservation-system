import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface LaravelRequest {
  token?: string;
  body?: unknown;
  params?: object;
  headers?: Record<string, string>;
  // Return the raw bytes (e.g. a PDF) instead of JSON.
  binary?: boolean;
}

/**
 * REST client for the Laravel service. Forwards the user's token and turns
 * Laravel errors into HttpExceptions that GraphQL reports with their message.
 */
@Injectable()
export class LaravelClient {
  private readonly baseUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async request<T = any>(
    method: Method,
    path: string,
    { token, body, params, headers, binary }: LaravelRequest = {},
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${this.baseUrl}${path}`,
          data: body,
          params,
          timeout: 60000,
          responseType: binary ? 'arraybuffer' : 'json',
          headers: {
            Accept: binary ? 'application/pdf' : 'application/json',
            ...(token ? { Authorization: token } : {}),
            ...headers,
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      if (error?.response) {
        const data = binary
          ? this.parseBinaryError(error.response.data)
          : error.response.data;

        throw new HttpException(
          data || 'Laravel API error',
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Laravel API is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private parseBinaryError(data: ArrayBuffer) {
    try {
      return JSON.parse(Buffer.from(data).toString('utf8'));
    } catch {
      return null;
    }
  }
}
