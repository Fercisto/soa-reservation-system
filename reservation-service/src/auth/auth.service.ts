import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(private readonly httpService: HttpService) {}

  async getUser(authorization: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('http://127.0.0.1:8000/api/me', {
          headers: {
            Authorization: authorization,
          },
        }),
      );

      return response.data.user;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}