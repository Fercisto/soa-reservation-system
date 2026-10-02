import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { UpdateReservationDatesDto } from './dto/update-reservation-dates.dto.js';

@Injectable()
export class ReservationsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll(authorization: string) {
    return this.request('get', '/reservations', undefined, authorization);
  }

  async findOne(id: string, authorization: string) {
    return this.request(
      'get',
      `/reservations/${id}`,
      undefined,
      authorization,
    );
  }

  async create(
    createReservationDto: CreateReservationDto,
    authorization: string,
  ) {
    return this.request(
      'post',
      '/reservations',
      createReservationDto,
      authorization,
    );
  }

  async updateDates(
    id: string,
    updateReservationDatesDto: UpdateReservationDatesDto,
    authorization: string,
  ) {
    return this.request(
      'patch',
      `/reservations/${id}/dates`,
      updateReservationDatesDto,
      authorization,
    );
  }

  async cancel(id: string, authorization: string) {
    return this.request(
      'patch',
      `/reservations/${id}/cancel`,
      {},
      authorization,
    );
  }

  private async request(
    method: 'get' | 'post' | 'patch',
    path: string,
    body: unknown,
    authorization: string,
  ) {
    try {
      const headers = { Authorization: authorization };
      const response = await firstValueFrom(
        method === 'get'
          ? this.httpService.get(`${this.laravelApiUrl}${path}`, { headers })
          : method === 'post'
            ? this.httpService.post(`${this.laravelApiUrl}${path}`, body, {
                headers,
              })
            : this.httpService.patch(`${this.laravelApiUrl}${path}`, body, {
                headers,
              }),
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