import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { DishInput, EmployeeInput } from './restaurant.models.js';

type Method = 'get' | 'post' | 'put' | 'delete';

/**
 * Client for the restaurant system's menu-service and employee-service.
 * Each hotel is identified with its own X-Api-Key, so it only sees and manages its own data.
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

  findCategories(apiKey: string) {
    return this.request(apiKey, 'get', `${this.menuUrl}/categories`);
  }

  createCategory(apiKey: string, name: string) {
    return this.request(apiKey, 'post', `${this.menuUrl}/categories`, { name });
  }

  updateCategory(apiKey: string, id: string, name: string) {
    return this.request(apiKey, 'put', `${this.menuUrl}/categories/${id}`, { name });
  }

  deleteCategory(apiKey: string, id: string) {
    return this.request(apiKey, 'delete', `${this.menuUrl}/categories/${id}`);
  }

  findDishes(apiKey: string, categoryId?: number) {
    return this.request(apiKey, 'get', `${this.menuUrl}/dishes`, undefined, {
      categoryId,
    });
  }

  createDish(apiKey: string, input: DishInput) {
    return this.request(apiKey, 'post', `${this.menuUrl}/dishes`, input);
  }

  updateDish(apiKey: string, id: string, input: DishInput) {
    return this.request(apiKey, 'put', `${this.menuUrl}/dishes/${id}`, input);
  }

  deleteDish(apiKey: string, id: string) {
    return this.request(apiKey, 'delete', `${this.menuUrl}/dishes/${id}`);
  }

  // Employees

  findEmployees(apiKey: string, filters: { role?: string; shift?: string; active?: boolean }) {
    return this.request(apiKey, 'get', this.employeesUrl, undefined, filters);
  }

  findRoles(apiKey: string) {
    return this.request(apiKey, 'get', `${this.employeesUrl}/roles`);
  }

  findShifts(apiKey: string) {
    return this.request(apiKey, 'get', `${this.employeesUrl}/shifts`);
  }

  createEmployee(apiKey: string, input: EmployeeInput) {
    return this.request(apiKey, 'post', this.employeesUrl, input);
  }

  updateEmployee(apiKey: string, id: string, input: EmployeeInput) {
    return this.request(apiKey, 'put', `${this.employeesUrl}/${id}`, input);
  }

  deleteEmployee(apiKey: string, id: string) {
    return this.request(apiKey, 'delete', `${this.employeesUrl}/${id}`);
  }

  private async request(
    apiKey: string,
    method: Method,
    url: string,
    body?: unknown,
    params?: object,
  ) {
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
