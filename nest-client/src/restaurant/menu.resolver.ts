import { Args, Context, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/auth.decorator.js';
import { Dish, DishInput, MenuCategory } from './restaurant.models.js';
import { RestaurantAccess } from './restaurant-access.js';
import { RestaurantService } from './restaurant.service.js';

/**
 * Hotel restaurant menu (Gold plan), stored in the classmate's menu-service with
 * the hotel's own API key. Guests read it by hotel; the hotel's admins manage it.
 */
@Resolver(() => Dish)
export class MenuResolver {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly access: RestaurantAccess,
    private readonly authService: AuthService,
  ) {}

  @Query(() => [MenuCategory], {
    description: "A hotel's menu categories; without hotelSlug, the admin's own hotel",
  })
  async menuCategories(
    @Context() context: any,
    @Args('hotelSlug', { nullable: true }) hotelSlug?: string,
  ): Promise<MenuCategory[]> {
    return this.restaurantService.findCategories(await this.readKey(context, hotelSlug));
  }

  @Query(() => [Dish], {
    description: "A hotel's dishes; without hotelSlug, the admin's own hotel",
  })
  async menuDishes(
    @Context() context: any,
    @Args('hotelSlug', { nullable: true }) hotelSlug?: string,
    @Args('categoryId', { type: () => Int, nullable: true })
    categoryId?: number,
  ): Promise<Dish[]> {
    return this.restaurantService.findDishes(await this.readKey(context, hotelSlug), categoryId);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => MenuCategory)
  async createMenuCategory(
    @CurrentUser() user: any,
    @Args('name') name: string,
  ): Promise<MenuCategory> {
    return this.restaurantService.createCategory(await this.adminKey(user), name);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => MenuCategory)
  async updateMenuCategory(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
    @Args('name') name: string,
  ): Promise<MenuCategory> {
    return this.restaurantService.updateCategory(await this.adminKey(user), id, name);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteMenuCategory(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteCategory(await this.adminKey(user), id);
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Dish)
  async createDish(
    @CurrentUser() user: any,
    @Args('input') input: DishInput,
  ): Promise<Dish> {
    return this.restaurantService.createDish(await this.adminKey(user), input);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Dish)
  async updateDish(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: DishInput,
  ): Promise<Dish> {
    return this.restaurantService.updateDish(await this.adminKey(user), id, input);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteDish(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteDish(await this.adminKey(user), id);
    return true;
  }

  private adminKey(user: any): Promise<string> {
    return this.access.keyForAdmin(user, 'restaurant');
  }

  /**
   * Guests read a hotel's menu by its slug, without signing in. Admins omit it to read their own.
   */
  private async readKey(context: any, hotelSlug?: string): Promise<string> {
    if (hotelSlug) {
      return this.access.keyForGuests(hotelSlug);
    }

    const authorization = context?.req?.headers?.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }

    return this.adminKey(await this.authService.getUser(authorization));
  }
}
