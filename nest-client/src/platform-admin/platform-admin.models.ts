import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { JSONScalar } from '../common/json.scalar.js';

@ObjectType({ description: 'Health of one service of the platform' })
export class ServiceStatus {
  @Field() id: string;
  @Field() name: string;
  @Field({ description: 'Gateway, Laravel, external or messaging' }) group: string;
  @Field({ description: 'up | degraded | down | disabled' }) status: string;
  @Field(() => Int, { nullable: true }) latency_ms?: number;
  @Field({ nullable: true }) detail?: string;
}

@ObjectType({ description: 'A RabbitMQ queue' })
export class QueueStatus {
  @Field() name: string;
  @Field(() => Int, { description: 'Messages waiting to be processed' }) messages: number;
  @Field(() => Int, { description: 'Active consumers' }) consumers: number;
}

@ObjectType()
export class PlatformStatus {
  @Field() checked_at: string;
  @Field(() => [ServiceStatus]) services: ServiceStatus[];
  @Field(() => [QueueStatus]) queues: QueueStatus[];
  @Field({ nullable: true }) management_url?: string;
}

@ObjectType()
export class ServiceLogHotel {
  @Field(() => ID) id: number | string;
  @Field() name: string;
  @Field() slug: string;
}

@ObjectType({ description: 'One use of a service' })
export class ServiceLogEntry {
  @Field(() => ID) id: number | string;
  @Field() service: string;
  @Field() operation: string;
  @Field({ description: 'query | mutation | http | worker' }) kind: string;
  @Field({ description: 'gateway | worker' }) source: string;
  @Field({ nullable: true }) actor?: string;
  @Field({ nullable: true }) role?: string;
  @Field(() => ServiceLogHotel, { nullable: true }) hotel?: ServiceLogHotel;
  @Field() success: boolean;
  @Field(() => Int, { nullable: true }) status_code?: number;
  @Field({ nullable: true }) error?: string;
  @Field(() => Int) duration_ms: number;
  @Field() occurred_at: string;
}

@ObjectType()
export class ServiceLogPage {
  @Field(() => [ServiceLogEntry]) data: ServiceLogEntry[];
  @Field(() => Int) total: number;
  @Field(() => Int) page: number;
  @Field(() => Int) last_page: number;
}

@ObjectType({ description: 'Usage of the last 24 hours' })
export class ServiceLogSummary {
  @Field() since: string;
  @Field(() => Int) calls: number;
  @Field(() => Int) errors: number;
  @Field(() => Int) average_ms: number;
  @Field(() => JSONScalar, { description: '[{ service, calls, errors, average_ms }]' })
  services: unknown[];
  @Field(() => JSONScalar, { description: '[{ hour, calls, errors }] for the last 24 hours' })
  hours: unknown[];
  @Field(() => [String]) all_services: string[];
}
