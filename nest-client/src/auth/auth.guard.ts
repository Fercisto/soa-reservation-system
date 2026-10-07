import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context);
    const req =
      gqlCtx.getContext()?.req || context.switchToHttp().getRequest();

    const authorization = req?.headers?.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }

    const user = await this.authService.getUser(authorization);

    req.user = user;

    return true;
  }
}