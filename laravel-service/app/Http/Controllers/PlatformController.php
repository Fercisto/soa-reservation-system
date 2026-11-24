<?php

namespace App\Http\Controllers;

use App\Console\Commands\ConsumeMessages;
use App\Messaging\RabbitMq;
use App\Models\Hotel;
use App\Models\ServiceLog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Platform operator (superadmin): health of the services Laravel depends on,
 * the service usage log and every hotel on the platform.
 */
class PlatformController extends Controller
{
    /**
     * Each check: status up | down | degraded | disabled, latency and a short detail.
     */
    public function health()
    {
        return response()->json([
            'checked_at' => now()->toISOString(),
            'services' => [
                $this->check('database', 'Base de datos (MySQL)', function () {
                    DB::select('select 1');

                    return 'Conexión '.DB::connection()->getDriverName();
                }),
                $this->check('stripe', 'Stripe (pagos)', function () {
                    $secret = config('services.stripe.secret');

                    if (! $secret || config('services.payments.driver') === 'fake') {
                        return ['disabled', 'Sin clave de Stripe o con el driver de pruebas'];
                    }

                    Http::timeout(5)->withToken($secret)->get('https://api.stripe.com/v1/balance')->throw();

                    return str_starts_with($secret, 'sk_test_') ? 'Modo de prueba' : 'Modo productivo';
                }),
                $this->check('profact', 'Profact (facturación CFDI)', function () {
                    if (config('services.invoicing.driver') === 'fake') {
                        return ['disabled', 'Driver de pruebas'];
                    }

                    Http::timeout(5)->withOptions(['verify' => (bool) config('services.profact.verify_ssl')])
                        ->get(config('services.profact.wsdl'))->throw();

                    return extension_loaded('soap') ? 'WSDL disponible' : ['degraded', 'WSDL disponible, falta la extensión soap de PHP'];
                }),
                $this->check('rabbitmq', 'RabbitMQ (desde Laravel)', function () {
                    if (! RabbitMq::enabled()) {
                        return ['disabled', 'RABBITMQ_ENABLED=false: las notificaciones se guardan sin cola'];
                    }

                    $stats = app(RabbitMq::class)->queueStats();

                    return 'Conectado · '.collect($stats)->sum('messages').' mensajes en cola';
                }),
                $this->check('worker', 'Consumidor de colas', function () {
                    if (! RabbitMq::enabled()) {
                        return ['disabled', 'RabbitMQ desactivado'];
                    }

                    $heartbeat = Cache::get(ConsumeMessages::HEARTBEAT_KEY);

                    if (! $heartbeat) {
                        return ['down', 'No está corriendo: php artisan hospedia:consume'];
                    }

                    $seconds = (int) Carbon::parse($heartbeat)->diffInSeconds(now());

                    return $seconds <= 30
                        ? "Activo · último latido hace {$seconds} s"
                        : ['down', "Sin latido desde hace {$seconds} s: php artisan hospedia:consume"];
                }),
            ],
        ]);
    }

    public function logs(Request $request)
    {
        $validated = $request->validate([
            'service' => 'nullable|string|max:40',
            'result' => 'nullable|in:ok,error',
            'hotel_id' => 'nullable|integer',
            'search' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $logs = ServiceLog::query()
            ->with('hotel:id,name,slug')
            ->when($validated['service'] ?? null, fn ($query, $service) => $query->where('service', $service))
            ->when(($validated['result'] ?? null) === 'ok', fn ($query) => $query->where('success', true))
            ->when(($validated['result'] ?? null) === 'error', fn ($query) => $query->where('success', false))
            ->when($validated['hotel_id'] ?? null, fn ($query, $hotel) => $query->where('hotel_id', $hotel))
            ->when($validated['search'] ?? null, fn ($query, $search) => $query->where(fn ($query) => $query
                ->where('operation', 'like', "%{$search}%")
                ->orWhere('actor', 'like', "%{$search}%")
                ->orWhere('error', 'like', "%{$search}%")))
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate(50);

        return response()->json([
            'data' => $logs->items(),
            'total' => $logs->total(),
            'page' => $logs->currentPage(),
            'last_page' => $logs->lastPage(),
        ]);
    }

    /**
     * Usage of the last 24 hours: totals, per service and per hour.
     */
    public function summary()
    {
        $since = now()->subDay();
        $logs = ServiceLog::where('occurred_at', '>=', $since)->get(['service', 'success', 'duration_ms', 'occurred_at']);

        $hours = collect(range(23, 0))->map(function (int $back) use ($logs) {
            $start = now()->startOfHour()->subHours($back);
            $inHour = $logs->filter(fn (ServiceLog $log) => $log->occurred_at->between($start, $start->copy()->endOfHour()));

            return [
                'hour' => $start->toISOString(),
                'calls' => $inHour->count(),
                'errors' => $inHour->where('success', false)->count(),
            ];
        })->values();

        return response()->json([
            'since' => $since->toISOString(),
            'calls' => $logs->count(),
            'errors' => $logs->where('success', false)->count(),
            'average_ms' => (int) round($logs->avg('duration_ms') ?? 0),
            'services' => $logs->groupBy('service')
                ->map(fn ($items, $service) => [
                    'service' => $service,
                    'calls' => $items->count(),
                    'errors' => $items->where('success', false)->count(),
                    'average_ms' => (int) round($items->avg('duration_ms')),
                ])
                ->sortByDesc('calls')
                ->values(),
            'hours' => $hours,
            'all_services' => ServiceLog::query()->distinct()->orderBy('service')->pluck('service'),
        ]);
    }

    public function hotels()
    {
        return response()->json(
            Hotel::query()
                ->withCount(['rooms', 'reservations', 'admins'])
                ->with('admins:id,hotel_id,name,email')
                ->orderBy('name')
                ->get()
                ->map(fn (Hotel $hotel) => [
                    ...$hotel->toArray(),
                    'last_activity_at' => ServiceLog::where('hotel_id', $hotel->id)->max('occurred_at'),
                ])
        );
    }

    /**
     * Runs a check and measures it. The callback returns a detail, or [status, detail].
     */
    private function check(string $id, string $name, callable $probe): array
    {
        $startedAt = microtime(true);

        try {
            $result = $probe();
            [$status, $detail] = is_array($result) ? $result : ['up', $result];
        } catch (Throwable $exception) {
            [$status, $detail] = ['down', $exception->getMessage()];
        }

        return [
            'id' => $id,
            'name' => $name,
            'status' => $status,
            'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            'detail' => mb_strimwidth((string) $detail, 0, 200, '…'),
        ];
    }
}
