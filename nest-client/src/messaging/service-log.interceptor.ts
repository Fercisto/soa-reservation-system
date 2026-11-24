import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

import { MessagingService, QUEUES } from './messaging.service.js';

// Service each GraphQL operation belongs to, shown in the platform's usage log.
const SERVICES: Record<string, string> = {
  login: 'Autenticación',
  register: 'Autenticación',
  logout: 'Autenticación',
  me: 'Autenticación',
  platformCatalog: 'Hoteles',
  hotels: 'Hoteles',
  hotel: 'Hoteles',
  registerHotel: 'Hoteles',
  myHotel: 'Hoteles',
  updateMyHotel: 'Hoteles',
  rooms: 'Habitaciones',
  room: 'Habitaciones',
  availableRooms: 'Habitaciones',
  createRoom: 'Habitaciones',
  updateRoom: 'Habitaciones',
  updateRoomStatus: 'Habitaciones',
  deleteRoom: 'Habitaciones',
  reservations: 'Reservaciones',
  reservation: 'Reservaciones',
  createReservation: 'Reservaciones',
  updateReservationDates: 'Reservaciones',
  cancelReservation: 'Reservaciones',
  payments: 'Pagos',
  payment: 'Pagos',
  createPayment: 'Pagos',
  verifyPayment: 'Pagos',
  invoices: 'Facturación',
  invoice: 'Facturación',
  requestInvoice: 'Facturación',
  cancelInvoice: 'Facturación',
  adminSummary: 'Resumen',
  markNotificationAsRead: 'Notificaciones',
  markAllNotificationsAsRead: 'Notificaciones',
  billingPayments: 'Suscripción y créditos',
  subscribe: 'Suscripción y créditos',
  buyCredits: 'Suscripción y créditos',
  verifyBillingPayment: 'Suscripción y créditos',
  creditTransactions: 'Suscripción y créditos',
  featurePasses: 'Suscripción y créditos',
  buyPass: 'Suscripción y créditos',
  reports: 'Reportes',
  generateReport: 'Reportes',
  reportPdf: 'Reportes',
  analytics: 'Analítica',
  campaigns: 'Campañas',
  sendCampaign: 'Campañas',
  menuCategories: 'Restaurante',
  menuDishes: 'Restaurante',
  createMenuCategory: 'Restaurante',
  updateMenuCategory: 'Restaurante',
  deleteMenuCategory: 'Restaurante',
  createDish: 'Restaurante',
  updateDish: 'Restaurante',
  deleteDish: 'Restaurante',
  employees: 'Personal',
  employeeRoles: 'Personal',
  employeeShifts: 'Personal',
  createEmployee: 'Personal',
  updateEmployee: 'Personal',
  deleteEmployee: 'Personal',
};

// Polled every few seconds by the panels; logging them would bury real usage.
const NOT_LOGGED = new Set([
  'notifications',
  'serviceStatus',
  'serviceLogs',
  'serviceLogSummary',
  'platformHotels',
]);

/**
 * Publishes one usage event per GraphQL operation and per REST call of external
 * systems to RabbitMQ. Laravel's consumer stores them in the service log.
 */
@Injectable()
export class ServiceLogInterceptor implements NestInterceptor {
  constructor(private readonly messaging: MessagingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entry = this.describe(context);

    if (!entry) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.publish(entry, startedAt),
        error: (error) => this.publish(entry, startedAt, error),
      }),
    );
  }

  private describe(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const gql = GqlExecutionContext.create(context);
      const info = gql.getInfo();
      const parent = info?.parentType?.name;

      // Only the operations the client asked for, not the fields inside them.
      if (!['Query', 'Mutation'].includes(parent) || NOT_LOGGED.has(info.fieldName)) {
        return null;
      }

      return {
        operation: info.fieldName as string,
        kind: parent === 'Mutation' ? 'mutation' : 'query',
        service: SERVICES[info.fieldName] || 'Otros',
        req: gql.getContext()?.req,
      };
    }

    const req = context.switchToHttp().getRequest();
    const path: string = req?.route?.path || req?.path || '';

    if (!path.startsWith('/v1/')) {
      return null;
    }

    return {
      operation: `${req.method} ${path}`,
      kind: 'http',
      service: path.startsWith('/v1/notifications')
        ? 'API externa: notificaciones'
        : 'API externa: pagos',
      req,
    };
  }

  private publish(
    entry: NonNullable<ReturnType<ServiceLogInterceptor['describe']>>,
    startedAt: number,
    error?: any,
  ) {
    const { req } = entry;
    const user = req?.user;
    const apiKey: string | undefined = req?.headers?.['x-api-key'];

    void this.messaging.publish(QUEUES.serviceLogs, {
      service: entry.service,
      operation: entry.operation,
      kind: entry.kind,
      source: 'gateway',
      user_id: user?.id ?? null,
      actor: user?.email ?? (apiKey ? `Sistema externo ${apiKey.slice(0, 7)}…` : null),
      role: user?.role ?? (apiKey ? 'external' : null),
      hotel_id: user?.hotel_id ?? null,
      success: !error,
      status_code: error
        ? error instanceof HttpException
          ? error.getStatus()
          : 500
        : null,
      error: error ? this.errorMessage(error) : null,
      duration_ms: Date.now() - startedAt,
      ip: req?.ip ?? null,
      occurred_at: new Date().toISOString(),
    });
  }

  private errorMessage(error: any): string {
    const response = error instanceof HttpException ? error.getResponse() : null;
    const message =
      (typeof response === 'object' && (response as any)?.message) ||
      (typeof response === 'string' ? response : null) ||
      error?.message ||
      'Error';

    return Array.isArray(message) ? message[0] : String(message);
  }
}
