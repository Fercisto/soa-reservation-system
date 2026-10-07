import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentAuthToken = createParamDecorator(
  (data: unknown, context: ExecutionContext): string | undefined => {
    const gqlCtx = GqlExecutionContext.create(context);
    const req =
      gqlCtx.getContext()?.req || context.switchToHttp().getRequest();
    return req?.headers?.authorization;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(context);
    const req =
      gqlCtx.getContext()?.req || context.switchToHttp().getRequest();
    return req?.user;
  },
);

