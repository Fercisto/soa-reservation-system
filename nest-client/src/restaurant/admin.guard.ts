import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AuthGuard } from '../auth/auth.guard.js';

/**
 * Like AuthGuard, but only lets hotel administrators through. Laravel enforces roles
 * for its own endpoints; the restaurant services don't know hotel users, so Nest does it here.
 */
@Injectable()
export class AdminGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext()?.req || context.switchToHttp().getRequest();

    if (req.user?.role !== 'admin') {
      throw new ForbiddenException(
        'Only administrators can manage this resource',
      );
    }

    return true;
  }
}
