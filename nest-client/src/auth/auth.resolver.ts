import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentAuthToken, CurrentUser } from './auth.decorator.js';
import { User } from './models/user.model.js';
import { AuthPayload } from './models/auth-payload.model.js';
import { LoginInput, RegisterInput } from './dto/auth.inputs.js';

@Resolver(() => User)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async logout(@CurrentAuthToken() token?: string): Promise<boolean> {
    if (token) {
      await this.authService.logout(token);
    }
    return true;
  }

  @UseGuards(AuthGuard)
  @Query(() => User)
  async me(@CurrentUser() user: User): Promise<User> {
    return user;
  }
}

