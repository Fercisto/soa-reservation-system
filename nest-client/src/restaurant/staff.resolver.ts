import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/auth.decorator.js';
import { RestaurantAccess } from './restaurant-access.js';
import { Employee, EmployeeInput } from './restaurant.models.js';
import { RestaurantService } from './restaurant.service.js';

/**
 * Hotel staff and shifts (Silver and Gold plans), stored in the classmate's employee-service
 * with the hotel's own API key. Admins of the hotel only.
 */
@UseGuards(AuthGuard)
@Resolver(() => Employee)
export class StaffResolver {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly access: RestaurantAccess,
  ) {}

  @Query(() => [Employee])
  async employees(
    @CurrentUser() user: any,
    @Args('role', { nullable: true }) role?: string,
    @Args('shift', { nullable: true }) shift?: string,
    @Args('active', { nullable: true }) active?: boolean,
  ): Promise<Employee[]> {
    return this.restaurantService.findEmployees(await this.key(user), { role, shift, active });
  }

  @Query(() => [String])
  async employeeRoles(@CurrentUser() user: any): Promise<string[]> {
    return this.restaurantService.findRoles(await this.key(user));
  }

  @Query(() => [String])
  async employeeShifts(@CurrentUser() user: any): Promise<string[]> {
    return this.restaurantService.findShifts(await this.key(user));
  }

  @Mutation(() => Employee)
  async createEmployee(
    @CurrentUser() user: any,
    @Args('input') input: EmployeeInput,
  ): Promise<Employee> {
    return this.restaurantService.createEmployee(await this.key(user), input);
  }

  @Mutation(() => Employee)
  async updateEmployee(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: EmployeeInput,
  ): Promise<Employee> {
    return this.restaurantService.updateEmployee(await this.key(user), id, input);
  }

  @Mutation(() => Boolean)
  async deleteEmployee(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteEmployee(await this.key(user), id);
    return true;
  }

  private key(user: any): Promise<string> {
    return this.access.keyForAdmin(user, 'staff');
  }
}
