import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

function requestFrom(context: ExecutionContext) {
  return context.getType<string>() === 'graphql'
    ? GqlExecutionContext.create(context).getContext()?.req
    : context.switchToHttp().getRequest();
}

/**
 * External systems authenticate with X-Api-Key. The gateway only requires the
 * header; Laravel validates the key and decides which data the client can access.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!requestFrom(context)?.headers?.['x-api-key']) {
      throw new UnauthorizedException('X-Api-Key header is required');
    }

    return true;
  }
}

export const ApiKey = createParamDecorator(
  (data: unknown, context: ExecutionContext): string =>
    requestFrom(context)?.headers?.['x-api-key'],
);
