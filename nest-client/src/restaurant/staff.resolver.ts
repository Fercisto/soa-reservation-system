import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AdminGuard } from './admin.guard.js';
import { Employee, EmployeeInput } from './restaurant.models.js';
import { RestaurantService } from './restaurant.service.js';

/**
 * Hotel staff and shifts, stored in the classmate's employee-service. Admins only.
 */
@UseGuards(AdminGuard)
@Resolver(() => Employee)
export class StaffResolver {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Query(() => [Employee])
  employees(
    @Args('role', { nullable: true }) role?: string,
    @Args('shift', { nullable: true }) shift?: string,
    @Args('active', { nullable: true }) active?: boolean,
  ): Promise<Employee[]> {
    return this.restaurantService.findEmployees({ role, shift, active });
  }

  @Query(() => [String])
  employeeRoles(): Promise<string[]> {
    return this.restaurantService.findRoles();
  }

  @Query(() => [String])
  employeeShifts(): Promise<string[]> {
    return this.restaurantService.findShifts();
  }

  @Mutation(() => Employee)
  createEmployee(@Args('input') input: EmployeeInput): Promise<Employee> {
    return this.restaurantService.createEmployee(input);
  }

  @Mutation(() => Employee)
  updateEmployee(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: EmployeeInput,
  ): Promise<Employee> {
    return this.restaurantService.updateEmployee(id, input);
  }

  @Mutation(() => Boolean)
  async deleteEmployee(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.restaurantService.deleteEmployee(id);
    return true;
  }
}
