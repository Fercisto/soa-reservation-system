import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  private readonly authServiceUrl =
    process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8000/api';

  constructor(private readonly httpService: HttpService) {}

  async register(registerDto: RegisterDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.authServiceUrl}/register`, registerDto),
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.authServiceUrl}/login`, loginDto),
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async logout(authorization: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.authServiceUrl}/logout`,
          {},
          {
            headers: {
              Authorization: authorization,
            },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getUser(authorization: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/me`, {
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

  private handleError(error: any): never {
    if (error?.response) {
      throw new HttpException(
        error.response.data || 'Auth service error',
        error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    throw new HttpException(
      'Auth service is unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}