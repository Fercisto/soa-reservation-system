import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';

@Injectable()
export class RoomsService {
  private readonly laravelApiUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async findAll() {
    return this.request('get', '/rooms');
  }

  async findAvailable() {
    return this.request('get', '/rooms/available');
  }

  async findOne(id: string) {
    return this.request('get', `/rooms/${id}`);
  }

  async update(id: string, room: CreateRoomDto, authorization: string) {
    return this.request('put', `/rooms/${id}`, room, authorization);
  }

  async remove(id: string, authorization: string) {
    return this.request('delete', `/rooms/${id}`, undefined, authorization);
  }

  async create(createRoomDto: CreateRoomDto, authorization: string) {
    return this.request(
      'post',
      '/rooms',
      createRoomDto,
      authorization,
    );
  }

  async updateStatus(
    id: string,
    updateRoomStatusDto: UpdateRoomStatusDto,
    authorization: string,
  ) {
    return this.request(
      'patch',
      `/rooms/${id}/status`,
      updateRoomStatusDto,
      authorization,
    );
  }

  private async request(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    body?: unknown,
    authorization?: string,
  ) {
    try {
      const headers = authorization
        ? { Authorization: authorization }
        : undefined;
      const response = await firstValueFrom(
        method === 'get'
          ? this.httpService.get(`${this.laravelApiUrl}${path}`, { headers })
          : method === 'post'
            ? this.httpService.post(`${this.laravelApiUrl}${path}`, body, {
                headers,
              })
            : method === 'put'
              ? this.httpService.put(`${this.laravelApiUrl}${path}`, body, {
                  headers,
                })
              : method === 'patch'
                ? this.httpService.patch(`${this.laravelApiUrl}${path}`, body, {
                    headers,
                  })
                : this.httpService.delete(`${this.laravelApiUrl}${path}`, {
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