import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AuthGuard } from '../auth/auth.guard.js';

/**
 * Signed-in platform operator (role superadmin). Laravel checks the role again on its routes.
 */
@Injectable()
export class SuperAdminGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const req = GqlExecutionContext.create(context).getContext()?.req;

    if (req?.user?.role !== 'superadmin') {
      throw new ForbiddenException('Only the platform operator can see this.');
    }

    return true;
  }
}
