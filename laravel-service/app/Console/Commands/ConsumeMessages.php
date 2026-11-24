<?php

namespace App\Console\Commands;

use App\Messaging\MessageHandler;
use App\Messaging\RabbitMq;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use PhpAmqpLib\Exception\AMQPTimeoutException;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

/**
 * RabbitMQ consumer: stores the service usage log and delivers the notifications.
 * Keep it running while the platform is in use: php artisan hospedia:consume
 */
class ConsumeMessages extends Command
{
    public const HEARTBEAT_KEY = 'hospedia:consumer_heartbeat';

    protected $signature = 'hospedia:consume {--once : Process the waiting messages and stop}';

    protected $description = 'Consume the service log and notification queues from RabbitMQ';

    public function handle(RabbitMq $broker, MessageHandler $handler): int
    {
        if (! RabbitMq::enabled()) {
            $this->error('RabbitMQ is disabled. Set RABBITMQ_ENABLED=true in .env.');

            return self::FAILURE;
        }

        $channel = $broker->channel();
        // Handle up to 10 unacknowledged messages at a time.
        $channel->basic_qos(0, 10, false);

        foreach (RabbitMq::QUEUES as $key => $queue) {
            $channel->basic_consume($queue, '', false, false, false, false, function (AMQPMessage $message) use ($key, $handler) {
                $this->process($key, $message, $handler);
            });
        }

        $this->info('Waiting for messages on '.implode(', ', RabbitMq::QUEUES).'. Press Ctrl+C to stop.');

        while ($channel->is_consuming()) {
            $this->heartbeat();

            try {
                $channel->wait(null, false, 5);
            } catch (AMQPTimeoutException) {
                // No messages in the last 5 seconds.
                if ($this->option('once')) {
                    break;
                }
            }
        }

        $broker->close();

        return self::SUCCESS;
    }

    private function process(string $queue, AMQPMessage $message, MessageHandler $handler): void
    {
        try {
            $handler->handle($queue, json_decode($message->getBody(), true, flags: JSON_THROW_ON_ERROR));
            $message->ack();
            $this->line(sprintf('[%s] %s processed', now()->format('H:i:s'), $queue));
        } catch (Throwable $exception) {
            report($exception);
            // Rejected messages go to the failed queue instead of being retried forever.
            $message->nack(false);
            $this->error(sprintf('[%s] %s failed: %s', now()->format('H:i:s'), $queue, $exception->getMessage()));
        }
    }

    /**
     * Lets the platform dashboard know the consumer is running.
     */
    private function heartbeat(): void
    {
        Cache::put(self::HEARTBEAT_KEY, now()->toISOString(), 120);
    }
}
