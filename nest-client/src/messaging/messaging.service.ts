import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

// Same queues and arguments Laravel declares (App\Messaging\RabbitMq).
export const QUEUES = {
  serviceLogs: 'hospedia.service_logs',
  notifications: 'hospedia.notifications',
};
export const FAILED_QUEUE = 'hospedia.failed';

const QUEUE_OPTIONS: amqp.Options.AssertQueue = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': '',
    'x-dead-letter-routing-key': FAILED_QUEUE,
  },
};

// After a failed connection, wait before trying again so requests don't pay for it.
const RETRY_AFTER_MS = 10000;

export interface QueueStats {
  name: string;
  messages: number;
  consumers: number;
}

/**
 * Publisher to RabbitMQ. Publishing never breaks a request: when the broker is down
 * the message is dropped, a warning is logged and the connection is retried later.
 */
@Injectable()
export class MessagingService implements OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private readonly url =
    process.env.RABBITMQ_URL || 'amqp://hospedia:hospedia@127.0.0.1:5672';
  private readonly enabled = process.env.RABBITMQ_ENABLED !== 'false';

  private connection: amqp.Connection | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private connecting: Promise<amqp.ConfirmChannel | null> | null = null;
  private retryAt = 0;
  lastError: string | null = null;

  get isEnabled() {
    return this.enabled;
  }

  get isConnected() {
    return this.channel !== null;
  }

  async publish(queue: string, payload: object): Promise<boolean> {
    const channel = await this.getChannel();

    if (!channel) {
      return false;
    }

    try {
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        contentType: 'application/json',
      });
      return true;
    } catch (error: any) {
      this.fail(error);
      return false;
    }
  }

  /**
   * Messages waiting and active consumers of each queue.
   */
  async queueStats(): Promise<QueueStats[]> {
    const channel = await this.getChannel(true);

    if (!channel) {
      throw new Error(this.lastError || 'RabbitMQ is not connected');
    }

    return Promise.all(
      [...Object.values(QUEUES), FAILED_QUEUE].map(async (name) => {
        const { messageCount, consumerCount } = await channel.checkQueue(name);
        return { name, messages: messageCount, consumers: consumerCount };
      }),
    );
  }

  async onModuleDestroy() {
    await this.connection?.close().catch(() => undefined);
  }

  private async getChannel(force = false): Promise<amqp.ConfirmChannel | null> {
    if (!this.enabled) {
      return null;
    }

    if (this.channel) {
      return this.channel;
    }

    if (!force && Date.now() < this.retryAt) {
      return null;
    }

    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private async connect(): Promise<amqp.ConfirmChannel | null> {
    try {
      const connection = await amqp.connect(this.url, { timeout: 3000 });
      const channel = await connection.createConfirmChannel();

      await channel.assertQueue(FAILED_QUEUE, { durable: true });
      for (const queue of Object.values(QUEUES)) {
        await channel.assertQueue(queue, QUEUE_OPTIONS);
      }

      connection.on('error', (error) => this.fail(error));
      connection.on('close', () => this.reset());

      this.connection = connection;
      this.channel = channel;
      this.lastError = null;
      this.logger.log('Connected to RabbitMQ');

      return channel;
    } catch (error: any) {
      this.fail(error);
      return null;
    }
  }

  private fail(error: Error) {
    this.lastError = error?.message || 'RabbitMQ connection error';
    this.logger.warn(`RabbitMQ unavailable: ${this.lastError}`);
    this.reset();
  }

  private reset() {
    this.connection = null;
    this.channel = null;
    this.retryAt = Date.now() + RETRY_AFTER_MS;
  }
}
