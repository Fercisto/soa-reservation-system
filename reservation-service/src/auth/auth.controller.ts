import {
  Controller,
  Get,
  Headers,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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