import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { Dish, DishInput, MenuCategory } from './restaurant.models.js';
import { RestaurantService } from './restaurant.service.js';

/**
 * Hotel restaurant menu. Data lives in the classmate's menu-service; any signed-in
 * user can read it and only admins can change it.
 */
@Resolver(() => Dish)
export class MenuResolver {
  constructor(private readonly restaurantService: RestaurantService) {}

  @UseGuards(AuthGuard)
  @Query(() => [MenuCategory])
  menuCategories(): Promise<MenuCategory[]> {
    return this.restaurantService.findCategories();
  }

  @UseGuards(AuthGuard)
  @Query(() => [Dish])
  menuDishes(
    @Args('categoryId', { type: () => Int, nullable: true })
    categoryId?: number,
  ): Promise<Dish[]> {
    return this.restaurantService.findDishes(categoryId);
  }

  @UseGuards(AdminGuard)
  @Mutation(() => MenuCategory)
  createMenuCategory(@Args('name') name: string): Promise<MenuCategory> {
    return this.restaurantService.createCategory(name);
  }

  @UseGuards(AdminGuard)
  @Mutation(() => MenuCategory)
  updateMenuCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('name') name: string,
  ): Promise<MenuCategory> {
    return this.restaurantService.updateCategory(id, name);
  }

  @UseGuards(AdminGuard)
  @Mutation(() => Boolean)
  async deleteMenuCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteCategory(id);
    return true;
  }

  @UseGuards(AdminGuard)
  @Mutation(() => Dish)
  createDish(@Args('input') input: DishInput): Promise<Dish> {
    return this.restaurantService.createDish(input);
  }

  @UseGuards(AdminGuard)
  @Mutation(() => Dish)
  updateDish(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: DishInput,
  ): Promise<Dish> {
    return this.restaurantService.updateDish(id, input);
  }

  @UseGuards(AdminGuard)
  @Mutation(() => Boolean)
  async deleteDish(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteDish(id);
    return true;
  }
}
