import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { LaravelClient } from '../common/laravel.client.js';
import { JSONScalar } from '../common/json.scalar.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { SuperAdminGuard } from './superadmin.guard.js';
import {
  PlatformStatus,
  ServiceLogPage,
  ServiceLogSummary,
  ServiceStatus,
} from './platform-admin.models.js';

const startedAt = Date.now();

/**
 * Platform operator (superadmin): health of every service, RabbitMQ queues,
 * the service usage log and all the hotels.
 */
@UseGuards(SuperAdminGuard)
@Resolver()
export class PlatformAdminResolver {
  constructor(
    private readonly laravel: LaravelClient,
    private readonly messaging: MessagingService,
    private readonly http: HttpService,
  ) {}

  @Query(() => PlatformStatus, { description: 'Checks every service now' })
  async serviceStatus(@CurrentAuthToken() token: string): Promise<PlatformStatus> {
    const [laravel, restaurantMenu, restaurantStaff, rabbit] = await Promise.all([
      this.laravelHealth(token),
      this.ping('restaurant-menu', 'Menú del restaurante (compañero)', process.env.RESTAURANT_MENU_URL, '/categories'),
      this.ping('restaurant-staff', 'Personal (compañero)', process.env.RESTAURANT_EMPLOYEES_URL, '/shifts'),
      this.rabbitStatus(),
    ]);

    const gateway: ServiceStatus = {
      id: 'gateway',
      name: 'Gateway GraphQL (NestJS)',
      group: 'Gateway',
      status: 'up',
      latency_ms: 0,
      detail: `Activo hace ${Math.round((Date.now() - startedAt) / 60000)} min · Node ${process.version}`,
    };

    return {
      checked_at: new Date().toISOString(),
      services: [gateway, ...laravel, rabbit.service, restaurantMenu, restaurantStaff],
      queues: rabbit.queues,
      management_url: process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672',
    };
  }

  @Query(() => ServiceLogPage)
  serviceLogs(
    @CurrentAuthToken() token: string,
    @Args('service', { nullable: true }) service?: string,
    @Args('result', { nullable: true, description: 'ok | error' }) result?: string,
    @Args('hotelId', { type: () => Int, nullable: true }) hotelId?: number,
    @Args('search', { nullable: true }) search?: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<ServiceLogPage> {
    return this.laravel.request('get', '/platform/logs', {
      token,
      params: { service, result, hotel_id: hotelId, search, page },
    });
  }

  @Query(() => ServiceLogSummary)
  serviceLogSummary(@CurrentAuthToken() token: string): Promise<ServiceLogSummary> {
    return this.laravel.request('get', '/platform/logs/summary', { token });
  }

  @Query(() => JSONScalar, { description: 'Every hotel with its plan, credits, admins and activity' })
  platformHotels(@CurrentAuthToken() token: string): Promise<unknown> {
    return this.laravel.request('get', '/platform/hotels', { token });
  }

  /**
   * Laravel itself plus what it checks: MySQL, Stripe, Profact and the queue consumer.
   */
  private async laravelHealth(token: string): Promise<ServiceStatus[]> {
    const started = Date.now();

    try {
      const health = await this.laravel.request('get', '/platform/health', { token });

      return [
        {
          id: 'laravel',
          name: 'API de negocio (Laravel)',
          group: 'Laravel',
          status: 'up',
          latency_ms: Date.now() - started,
          detail: 'Responde a /api/platform/health',
        },
        ...health.services.map((service: ServiceStatus) => ({
          ...service,
          group: ['stripe', 'profact'].includes(service.id)
            ? 'Externo'
            : ['rabbitmq', 'worker'].includes(service.id)
              ? 'Mensajería'
              : 'Laravel',
        })),
      ];
    } catch (error: any) {
      const detail = error?.message || 'Sin respuesta';

      return [
        { id: 'laravel', name: 'API de negocio (Laravel)', group: 'Laravel', status: 'down', latency_ms: Date.now() - started, detail },
        ...['Base de datos (MySQL)', 'Stripe (pagos)', 'Profact (facturación CFDI)', 'Consumidor de colas'].map((name, index) => ({
          id: ['database', 'stripe', 'profact', 'worker'][index],
          name,
          group: index === 1 || index === 2 ? 'Externo' : index === 3 ? 'Mensajería' : 'Laravel',
          status: 'down',
          detail: 'No se pudo revisar: Laravel no responde',
        })),
      ];
    }
  }

  private async rabbitStatus(): Promise<{ service: ServiceStatus; queues: any[] }> {
    const started = Date.now();
    const base = { id: 'rabbitmq', name: 'RabbitMQ (broker)', group: 'Mensajería' };

    if (!this.messaging.isEnabled) {
      return { service: { ...base, status: 'disabled', detail: 'RABBITMQ_ENABLED=false' }, queues: [] };
    }

    try {
      const queues = await this.messaging.queueStats();
      const waiting = queues.reduce((sum, queue) => sum + queue.messages, 0);

      return {
        service: {
          ...base,
          status: 'up',
          latency_ms: Date.now() - started,
          detail: `${waiting} mensajes en espera en ${queues.length} colas`,
        },
        queues,
      };
    } catch (error: any) {
      return {
        service: { ...base, status: 'down', latency_ms: Date.now() - started, detail: error?.message },
        queues: [],
      };
    }
  }

  /**
   * The classmate's services are up if they answer at all (they reply 401 without an API key).
   */
  private async ping(id: string, name: string, baseUrl: string | undefined, path: string): Promise<ServiceStatus> {
    const base = { id, name, group: 'Externo' };

    if (!baseUrl) {
      return { ...base, status: 'disabled', detail: 'URL no configurada' };
    }

    const started = Date.now();

    try {
      const response = await firstValueFrom(
        this.http.get(`${baseUrl}${path}`, { timeout: 4000, validateStatus: () => true }),
      );

      return {
        ...base,
        status: response.status < 500 ? 'up' : 'degraded',
        latency_ms: Date.now() - started,
        detail: `HTTP ${response.status} · ${new URL(baseUrl).host}`,
      };
    } catch (error: any) {
      return {
        ...base,
        status: 'down',
        latency_ms: Date.now() - started,
        detail: `${error?.code || error?.message || 'Sin respuesta'} · ${new URL(baseUrl).host}`,
      };
    }
  }
}
