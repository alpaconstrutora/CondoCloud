import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Profile } from '@condocloud/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Profile => {
    const request = ctx.switchToHttp().getRequest<{ user: Profile }>();
    return request.user;
  },
);
