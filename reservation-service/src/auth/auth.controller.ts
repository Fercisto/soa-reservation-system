import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }
    return this.authService.logout(authorization);
  }

  @Get('me')
  async me(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }

    return this.authService.getUser(authorization);
  }

  @UseGuards(AuthGuard)
  @Get('protected')
  protected(@Req() request: any) {
    return {
      message: 'You have access to this protected route',
      user: request.user,
    };
  }
}