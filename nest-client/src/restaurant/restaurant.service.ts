import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { DishInput, EmployeeInput } from './restaurant.models.js';

type Method = 'get' | 'post' | 'put' | 'delete';

/**
 * Client for the restaurant system's menu-service and employee-service.
 * The hotel is identified with X-Api-Key, so it only sees and manages its own data.
 */
@Injectable()
export class RestaurantService {
  private readonly menuUrl =
    process.env.RESTAURANT_MENU_URL || 'http://192.168.1.100:8083/api/v1/menu';

  private readonly employeesUrl =
    process.env.RESTAURANT_EMPLOYEES_URL ||
    'http://192.168.1.100:8084/api/v1/employees';

  constructor(private readonly httpService: HttpService) {}

  // Menu

  findCategories() {
    return this.request('get', `${this.menuUrl}/categories`);
  }

  createCategory(name: string) {
    return this.request('post', `${this.menuUrl}/categories`, { name });
  }

  updateCategory(id: string, name: string) {
    return this.request('put', `${this.menuUrl}/categories/${id}`, { name });
  }

  deleteCategory(id: string) {
    return this.request('delete', `${this.menuUrl}/categories/${id}`);
  }

  findDishes(categoryId?: number) {
    return this.request('get', `${this.menuUrl}/dishes`, undefined, {
      categoryId,
    });
  }

  createDish(input: DishInput) {
    return this.request('post', `${this.menuUrl}/dishes`, input);
  }

  updateDish(id: string, input: DishInput) {
    return this.request('put', `${this.menuUrl}/dishes/${id}`, input);
  }

  deleteDish(id: string) {
    return this.request('delete', `${this.menuUrl}/dishes/${id}`);
  }

  // Employees

  findEmployees(filters: { role?: string; shift?: string; active?: boolean }) {
    return this.request('get', this.employeesUrl, undefined, filters);
  }

  findRoles() {
    return this.request('get', `${this.employeesUrl}/roles`);
  }

  findShifts() {
    return this.request('get', `${this.employeesUrl}/shifts`);
  }

  createEmployee(input: EmployeeInput) {
    return this.request('post', this.employeesUrl, input);
  }

  updateEmployee(id: string, input: EmployeeInput) {
    return this.request('put', `${this.employeesUrl}/${id}`, input);
  }

  deleteEmployee(id: string) {
    return this.request('delete', `${this.employeesUrl}/${id}`);
  }

  private async request(
    method: Method,
    url: string,
    body?: unknown,
    params?: object,
  ) {
    const apiKey = process.env.RESTAURANT_API_KEY;

    if (!apiKey) {
      throw new HttpException(
        'RESTAURANT_API_KEY is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          data: body,
          params,
          timeout: 8000,
          headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        }),
      );

      return response.data;
    } catch (error: any) {
      if (error?.response) {
        // The restaurant services answer errors as { status, message }.
        throw new HttpException(
          error.response.data?.message || 'Restaurant service error',
          error.response.status || HttpStatus.BAD_GATEWAY,
        );
      }

      throw new HttpException(
        'The restaurant service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
