<?php

namespace App\Messaging;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * Connection to RabbitMQ. Both queues are durable and their messages persistent, so they
 * survive a broker restart; a message that fails to process goes to the "failed" queue.
 */
class RabbitMq
{
    // Logical name => queue name. NestJS declares the same queues with the same arguments.
    public const QUEUES = [
        'service_logs' => 'hospedia.service_logs',
        'notifications' => 'hospedia.notifications',
    ];

    public const FAILED_QUEUE = 'hospedia.failed';

    private ?AMQPStreamConnection $connection = null;

    private ?AMQPChannel $channel = null;

    public static function enabled(): bool
    {
        return (bool) config('services.rabbitmq.enabled');
    }

    public function channel(): AMQPChannel
    {
        if ($this->channel?->is_open()) {
            return $this->channel;
        }

        $config = config('services.rabbitmq');

        $this->connection = new AMQPStreamConnection(
            $config['host'],
            $config['port'],
            $config['user'],
            $config['password'],
            $config['vhost'],
            connection_timeout: 3.0,
            read_write_timeout: 30.0,
            heartbeat: 15,
        );

        $this->channel = $this->connection->channel();
        $this->declareQueues($this->channel);

        return $this->channel;
    }

    public function publish(string $queue, array $payload): void
    {
        $message = new AMQPMessage(json_encode($payload, JSON_UNESCAPED_UNICODE), [
            'content_type' => 'application/json',
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
        ]);

        $this->channel()->basic_publish($message, '', self::QUEUES[$queue]);
    }

    /**
     * Messages waiting and active consumers of each queue.
     *
     * @return array<int, array{name: string, messages: int, consumers: int}>
     */
    public function queueStats(): array
    {
        $channel = $this->channel();

        return collect([...array_values(self::QUEUES), self::FAILED_QUEUE])
            ->map(function (string $name) use ($channel) {
                [, $messages, $consumers] = $channel->queue_declare($name, true);

                return ['name' => $name, 'messages' => $messages, 'consumers' => $consumers];
            })
            ->all();
    }

    public function close(): void
    {
        $this->channel?->close();
        $this->connection?->close();
        $this->channel = null;
        $this->connection = null;
    }

    private function declareQueues(AMQPChannel $channel): void
    {
        $channel->queue_declare(self::FAILED_QUEUE, false, true, false, false);

        $arguments = new AMQPTable([
            'x-dead-letter-exchange' => '',
            'x-dead-letter-routing-key' => self::FAILED_QUEUE,
        ]);

        foreach (self::QUEUES as $queue) {
            $channel->queue_declare($queue, false, true, false, false, false, $arguments);
        }
    }
}
