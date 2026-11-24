<?php

namespace Database\Seeders;

use App\Models\Campaign;
use App\Models\CreditTransaction;
use App\Models\FeaturePass;
use App\Models\Hotel;
use App\Models\Payment;
use App\Models\Report;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\ServiceLog;
use App\Models\User;
use App\Notifications\GuestCampaign;
use App\Notifications\ReservationNotifier;
use App\Saas\HotelStats;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/**
 * Demo platform: hotels on every plan (plus one expired and one that never paid),
 * their admins, guests, rooms and months of activity: stays, payments, refunds,
 * subscription periods, credit purchases and usage, reports, time passes and campaigns.
 *
 * Every account uses the password "password". Hotels that already have reservations
 * keep their data: running the seeder again only refreshes plans, users and rooms.
 */
class DemoDataSeeder extends Seeder
{
    private const PASSWORD = 'password';

    // Days of history generated for each hotel.
    private const HISTORY_DAYS = 150;

    // Days of future bookings.
    private const FUTURE_DAYS = 45;

    private const HOTELS = [
        [
            'slug' => 'casa-jacaranda',
            'name' => 'Hotel Casa Jacaranda',
            'city' => 'Aguascalientes',
            'description' => 'Hotel boutique en el centro histórico, a pasos de la plaza principal y del Jardín de San Marcos.',
            'plan' => 'gold',
            'expires_in' => 24,
            'admin' => ['admin@example.com', 'Laura Méndez'],
            'occupancy' => 'high',
            'rooms' => [
                ['101', 'Sencilla', 650, 1, ['Wi-Fi', 'Escritorio']],
                ['102', 'Doble', 900, 2, ['Wi-Fi', 'TV', 'Cafetera']],
                ['103', 'Doble', 900, 2, ['Wi-Fi', 'TV']],
                ['201', 'Junior suite', 1300, 3, ['Wi-Fi', 'TV', 'Balcón']],
                ['202', 'Junior suite', 1300, 3, ['Wi-Fi', 'TV', 'Tina']],
                ['301', 'Suite presidencial', 2400, 4, ['Wi-Fi', 'TV', 'Terraza', 'Jacuzzi']],
            ],
        ],
        [
            'slug' => 'bahia-dorada',
            'name' => 'Hotel Bahía Dorada',
            'city' => 'Cancún',
            'description' => 'Resort frente al mar Caribe con alberca infinita, club de playa y restaurante de mariscos.',
            'plan' => 'gold',
            'expires_in' => 9,
            'admin' => ['admin@bahiadorada.com', 'Ricardo Fuentes'],
            'occupancy' => 'high',
            'rooms' => [
                ['A1', 'Doble vista jardín', 1800, 2, ['Wi-Fi', 'Aire acondicionado']],
                ['A2', 'Doble vista jardín', 1800, 2, ['Wi-Fi', 'Aire acondicionado']],
                ['B1', 'Doble vista al mar', 2600, 2, ['Wi-Fi', 'Balcón', 'Vista al mar']],
                ['B2', 'Doble vista al mar', 2600, 2, ['Wi-Fi', 'Balcón', 'Vista al mar']],
                ['C1', 'Familiar', 3200, 5, ['Wi-Fi', 'Cocineta', 'Dos recámaras']],
                ['C2', 'Familiar', 3200, 5, ['Wi-Fi', 'Cocineta', 'Dos recámaras']],
                ['PH', 'Penthouse', 6500, 4, ['Wi-Fi', 'Terraza', 'Jacuzzi', 'Vista al mar']],
            ],
        ],
        [
            'slug' => 'sierra-alta',
            'name' => 'Hotel Sierra Alta',
            'city' => 'Monterrey',
            'description' => 'Hotel de negocios en San Pedro, con salas de juntas y vista al Cerro de la Silla.',
            'plan' => 'silver',
            'expires_in' => 17,
            'admin' => ['admin@sierraalta.com', 'Daniela Garza'],
            'occupancy' => 'medium',
            'rooms' => [
                ['501', 'Ejecutiva', 1400, 1, ['Wi-Fi', 'Escritorio', 'Cafetera']],
                ['502', 'Ejecutiva', 1400, 1, ['Wi-Fi', 'Escritorio', 'Cafetera']],
                ['503', 'Doble', 1600, 2, ['Wi-Fi', 'TV']],
                ['504', 'Doble', 1600, 2, ['Wi-Fi', 'TV']],
                ['601', 'Suite ejecutiva', 2800, 2, ['Wi-Fi', 'Sala', 'Vista a la montaña']],
            ],
        ],
        [
            'slug' => 'posada-del-rio',
            'name' => 'Posada del Río',
            'city' => 'Guanajuato',
            'description' => 'Casona colonial junto al callejón del Beso, con patio central y desayuno típico.',
            'plan' => 'silver',
            'expires_in' => 3,
            'admin' => ['admin@posadadelrio.com', 'Jorge Arriaga'],
            'occupancy' => 'medium',
            'rooms' => [
                ['1', 'Sencilla colonial', 750, 1, ['Wi-Fi']],
                ['2', 'Doble colonial', 1050, 2, ['Wi-Fi', 'Balcón']],
                ['3', 'Doble colonial', 1050, 2, ['Wi-Fi']],
                ['4', 'Suite del patio', 1650, 3, ['Wi-Fi', 'Chimenea']],
            ],
        ],
        [
            'slug' => 'mar-azul',
            'name' => 'Hotel Mar Azul',
            'city' => 'Mazatlán',
            'description' => 'Frente al malecón, a cinco minutos del centro histórico.',
            'plan' => 'bronze',
            'expires_in' => 21,
            'admin' => ['admin@marazul.com', 'Sofía Ibarra'],
            'occupancy' => 'medium',
            'rooms' => [
                ['1', 'Doble vista al mar', 1200, 2, ['Wi-Fi', 'Vista al mar']],
                ['2', 'Doble vista al mar', 1200, 2, ['Wi-Fi', 'Vista al mar']],
                ['3', 'Familiar', 1700, 5, ['Wi-Fi', 'Dos camas matrimoniales']],
            ],
        ],
        [
            'slug' => 'hostal-centro-oaxaca',
            'name' => 'Hostal Centro Oaxaca',
            'city' => 'Oaxaca',
            'description' => 'Hostal familiar a dos cuadras de Santo Domingo, con terraza y desayuno incluido.',
            'plan' => 'bronze',
            'expires_in' => 12,
            'admin' => ['admin@hostalcentro.com', 'Itzel Ramírez'],
            'occupancy' => 'low',
            'rooms' => [
                ['A', 'Compartida 4 camas', 350, 4, ['Wi-Fi', 'Lockers']],
                ['B', 'Privada sencilla', 600, 1, ['Wi-Fi']],
                ['C', 'Privada doble', 850, 2, ['Wi-Fi', 'Baño privado']],
            ],
        ],
        [
            'slug' => 'villa-del-pacifico',
            'name' => 'Villa del Pacífico',
            'city' => 'Puerto Vallarta',
            'description' => 'Hotel de playa en la Zona Romántica, a una cuadra del muelle de Los Muertos.',
            'plan' => 'silver',
            'expires_in' => 26,
            'admin' => ['admin@villapacifico.com', 'Mónica Salazar'],
            'occupancy' => 'high',
            'rooms' => [
                ['101', 'Doble vista a la ciudad', 1350, 2, ['Wi-Fi', 'Aire acondicionado']],
                ['102', 'Doble vista a la ciudad', 1350, 2, ['Wi-Fi', 'Aire acondicionado']],
                ['201', 'Doble vista al mar', 1950, 2, ['Wi-Fi', 'Balcón', 'Vista al mar']],
                ['202', 'Doble vista al mar', 1950, 2, ['Wi-Fi', 'Balcón', 'Vista al mar']],
                ['301', 'Suite con terraza', 3100, 4, ['Wi-Fi', 'Terraza', 'Jacuzzi']],
            ],
        ],
        [
            'slug' => 'casa-de-los-altos',
            'name' => 'Casa de los Altos',
            'city' => 'San Cristóbal de las Casas',
            'description' => 'Casa de huéspedes con chimenea en cada cuarto, a tres cuadras del andador de Guadalupe.',
            'plan' => 'bronze',
            'expires_in' => 8,
            'admin' => ['admin@casadelosaltos.com', 'Emiliano Gómez'],
            'occupancy' => 'medium',
            'rooms' => [
                ['1', 'Sencilla con chimenea', 700, 1, ['Wi-Fi', 'Chimenea']],
                ['2', 'Doble con chimenea', 950, 2, ['Wi-Fi', 'Chimenea']],
                ['3', 'Doble con chimenea', 950, 2, ['Wi-Fi', 'Chimenea']],
                ['4', 'Familiar', 1400, 4, ['Wi-Fi', 'Chimenea', 'Dos camas matrimoniales']],
            ],
        ],
        [
            'slug' => 'hacienda-los-agaves',
            'name' => 'Hacienda Los Agaves',
            'city' => 'Tequila',
            'description' => 'Antigua hacienda tequilera entre campos de agave, con recorridos por la destilería y spa.',
            'plan' => 'gold',
            'expires_in' => 15,
            'admin' => ['admin@losagaves.com', 'Rodrigo Villaseñor'],
            'occupancy' => 'medium',
            'rooms' => [
                ['H1', 'Habitación hacienda', 2200, 2, ['Wi-Fi', 'Chimenea']],
                ['H2', 'Habitación hacienda', 2200, 2, ['Wi-Fi', 'Chimenea']],
                ['H3', 'Habitación hacienda', 2200, 2, ['Wi-Fi', 'Chimenea']],
                ['S1', 'Suite del agave', 3800, 3, ['Wi-Fi', 'Tina', 'Terraza privada']],
                ['S2', 'Suite del agave', 3800, 3, ['Wi-Fi', 'Tina', 'Terraza privada']],
                ['C1', 'Casita familiar', 4500, 6, ['Wi-Fi', 'Cocineta', 'Jardín']],
            ],
        ],
        [
            'slug' => 'mirador-de-la-sierra',
            'name' => 'Mirador de la Sierra',
            'city' => 'Creel',
            'description' => 'Cabañas de madera en la Sierra Tarahumara, a la entrada de la Barranca del Cobre.',
            'plan' => 'silver',
            'expires_in' => 11,
            'admin' => ['admin@miradorsierra.com', 'Gabriel Chávez'],
            'occupancy' => 'low',
            'rooms' => [
                ['Cabaña 1', 'Cabaña doble', 1250, 2, ['Chimenea', 'Vista a la sierra']],
                ['Cabaña 2', 'Cabaña doble', 1250, 2, ['Chimenea', 'Vista a la sierra']],
                ['Cabaña 3', 'Cabaña familiar', 1800, 5, ['Chimenea', 'Cocineta']],
                ['Cabaña 4', 'Cabaña familiar', 1800, 5, ['Chimenea', 'Cocineta']],
            ],
        ],
        [
            'slug' => 'hotel-cielito-lindo',
            'name' => 'Hotel Cielito Lindo',
            'city' => 'Ciudad de México',
            'description' => 'Hotel de ciudad en la Roma Norte, rodeado de cafés, galerías y a diez minutos del Centro.',
            'plan' => 'gold',
            'expires_in' => 28,
            'admin' => ['admin@cielitolindo.com', 'Renata Ortiz'],
            'occupancy' => 'high',
            'rooms' => [
                ['201', 'Estudio', 1600, 2, ['Wi-Fi', 'Escritorio']],
                ['202', 'Estudio', 1600, 2, ['Wi-Fi', 'Escritorio']],
                ['203', 'Doble', 1900, 2, ['Wi-Fi', 'TV', 'Cafetera']],
                ['204', 'Doble', 1900, 2, ['Wi-Fi', 'TV', 'Cafetera']],
                ['301', 'Loft', 2600, 3, ['Wi-Fi', 'Cocineta', 'Doble altura']],
                ['302', 'Loft', 2600, 3, ['Wi-Fi', 'Cocineta', 'Doble altura']],
                ['401', 'Suite con roof', 4200, 4, ['Wi-Fi', 'Terraza', 'Vista a la ciudad']],
            ],
        ],
        [
            'slug' => 'posada-la-bufa',
            'name' => 'Posada La Bufa',
            'city' => 'Zacatecas',
            'description' => 'Posada familiar en el centro histórico, frente al teleférico al cerro de La Bufa.',
            'plan' => 'bronze',
            'expires_in' => 19,
            'admin' => ['admin@posadalabufa.com', 'Alejandra Márquez'],
            'occupancy' => 'medium',
            'rooms' => [
                ['1', 'Sencilla', 580, 1, ['Wi-Fi']],
                ['2', 'Doble', 820, 2, ['Wi-Fi', 'TV']],
                ['3', 'Doble', 820, 2, ['Wi-Fi', 'TV']],
                ['4', 'Triple', 1100, 3, ['Wi-Fi', 'TV']],
            ],
        ],
        [
            // The subscription ended a few days ago: the admin only sees "Mi plan" and guests can't book.
            'slug' => 'colonial-queretaro',
            'name' => 'Hotel Colonial Querétaro',
            'city' => 'Querétaro',
            'description' => 'Casona del siglo XVIII frente al Jardín Zenea.',
            'plan' => 'silver',
            'expires_in' => -5,
            'admin' => ['admin@colonialqro.com', 'Andrés Robles'],
            'occupancy' => 'low',
            'rooms' => [
                ['10', 'Doble', 1100, 2, ['Wi-Fi']],
                ['11', 'Doble', 1100, 2, ['Wi-Fi']],
                ['12', 'Suite', 1900, 3, ['Wi-Fi', 'Sala']],
            ],
        ],
        [
            // Signed up but never paid its first plan.
            'slug' => 'nuevo-amanecer',
            'name' => 'Hotel Nuevo Amanecer',
            'city' => 'Puebla',
            'description' => 'Hotel recién registrado en la plataforma.',
            'plan' => null,
            'expires_in' => null,
            'admin' => ['admin@nuevoamanecer.com', 'Patricia Luna'],
            'occupancy' => null,
            'rooms' => [],
        ],
    ];

    private const GUESTS = [
        ['customer@example.com', 'Customer User'],
        ['ana.torres@correo.mx', 'Ana Torres'],
        ['carlos.vega@correo.mx', 'Carlos Vega'],
        ['mariana.lopez@correo.mx', 'Mariana López'],
        ['javier.ruiz@correo.mx', 'Javier Ruiz'],
        ['fernanda.soto@correo.mx', 'Fernanda Soto'],
        ['miguel.herrera@correo.mx', 'Miguel Herrera'],
        ['valeria.cruz@correo.mx', 'Valeria Cruz'],
        ['roberto.navarro@correo.mx', 'Roberto Navarro'],
        ['lucia.morales@correo.mx', 'Lucía Morales'],
        ['diego.castillo@correo.mx', 'Diego Castillo'],
        ['paola.reyes@correo.mx', 'Paola Reyes'],
    ];

    // Days between stays and nights per stay, cycled so the data is the same on every run.
    private const GAPS = ['high' => [1, 0, 2, 1, 3, 0, 1], 'medium' => [2, 4, 1, 6, 3, 5, 2], 'low' => [5, 9, 4, 12, 7, 10, 6]];

    private const NIGHTS = [2, 3, 1, 4, 2, 5, 3, 2];

    private CarbonImmutable $today;

    private string $passwordHash;

    /** @var array<int, User> */
    private array $guests = [];

    // Credit movements of the hotel being seeded, applied in date order so each balance adds up.
    private array $movements = [];

    public function run(): void
    {
        $this->today = CarbonImmutable::now(config('services.hotel.timezone'))->startOfDay();
        $this->passwordHash = Hash::make(self::PASSWORD);

        foreach (self::GUESTS as [$email, $name]) {
            $this->guests[] = $this->user($email, $name, 'customer');
        }

        foreach (self::HOTELS as $definition) {
            $hotel = $this->hotel($definition);
            $admin = $this->user($definition['admin'][0], $definition['admin'][1], 'admin', $hotel);

            if ($definition['plan'] === null || $hotel->reservations()->exists()) {
                continue;
            }

            DB::transaction(fn () => $this->activity($hotel, $admin, $definition));
        }

        // Platform operator: service status and usage log.
        $this->user('superadmin@hospedia.mx', 'Operación Hospedia', 'superadmin');

        if (! ServiceLog::exists()) {
            DB::transaction(fn () => $this->serviceLogHistory());
        }
    }

    /**
     * A day of service usage so the platform dashboard has data before anyone uses the app.
     * From then on the log fills with real usage through RabbitMQ.
     */
    private function serviceLogHistory(): void
    {
        $operations = [
            ['Autenticación', 'login', 'mutation', 140],
            ['Hoteles', 'hotels', 'query', 45],
            ['Hoteles', 'hotel', 'query', 30],
            ['Habitaciones', 'availableRooms', 'query', 60],
            ['Reservaciones', 'reservations', 'query', 55],
            ['Reservaciones', 'createReservation', 'mutation', 420],
            ['Pagos', 'verifyPayment', 'mutation', 610],
            ['Facturación', 'requestInvoice', 'mutation', 1700],
            ['Suscripción y créditos', 'buyCredits', 'mutation', 520],
            ['Reportes', 'generateReport', 'mutation', 380],
            ['Analítica', 'analytics', 'query', 210],
            ['Restaurante', 'menuDishes', 'query', 160],
            ['Personal', 'employees', 'query', 150],
            ['Notificaciones', 'ReservationConfirmed', 'worker', 12],
        ];
        $hotels = Hotel::active()->with('admins')->get()->values();
        $rows = [];

        for ($index = 0; $index < 420; $index++) {
            [$service, $operation, $kind, $duration] = $operations[($index * 11 + intdiv($index, 3)) % count($operations)];
            // Different strides so services, hotels and guests mix instead of repeating together.
            $hotel = $hotels[($index * 5 + intdiv($index, 7)) % $hotels->count()];
            $admin = $hotel->admins->first();
            $guest = $this->guests[($index * 3 + intdiv($index, 5)) % count($this->guests)];
            $byAdmin = in_array($service, ['Suscripción y créditos', 'Reportes', 'Analítica', 'Personal'], true);
            $failed = $index % 23 === 7;
            $user = $kind === 'worker' ? null : ($byAdmin ? $admin : $guest);
            $occurredAt = now()->subMinutes(($index * 1440 / 420) + ($index % 5))->setSecond($index % 60);

            $rows[] = [
                'service' => $service,
                'operation' => $operation,
                'kind' => $kind,
                'source' => $kind === 'worker' ? 'worker' : 'gateway',
                'user_id' => $user?->id,
                'actor' => $kind === 'worker' ? '2 destinatarios' : $user?->email,
                'role' => $user?->role,
                'hotel_id' => $hotel->id,
                'success' => ! $failed,
                'status_code' => $failed ? [422, 402, 503][$index % 3] : null,
                'error' => $failed ? ['Room is already reserved for the selected dates.', 'Not enough credits: 3 required, 1 available. Buy a credit package.', 'The restaurant service is unavailable'][$index % 3] : null,
                'duration_ms' => (int) round($duration * (0.6 + ($index % 9) / 10)),
                'ip' => '127.0.0.1',
                'occurred_at' => $occurredAt->utc(),
                'created_at' => $occurredAt->utc(),
            ];
        }

        foreach (array_chunk($rows, 100) as $chunk) {
            ServiceLog::insert($chunk);
        }
    }

    private function hotel(array $definition): Hotel
    {
        $hotel = Hotel::firstOrNew(['slug' => $definition['slug']]);

        $hotel->fill([
            'name' => $definition['name'],
            'city' => $definition['city'],
            'description' => $definition['description'],
            'plan' => $definition['plan'],
            'plan_expires_at' => $definition['expires_in'] === null
                ? null
                : now()->addDays($definition['expires_in'])->setTime(23, 0),
        ])->save();

        foreach ($definition['rooms'] as [$number, $type, $price, $capacity, $features]) {
            $hotel->rooms()->updateOrCreate(['number' => $number], [
                'type' => $type,
                'price' => $price,
                'capacity' => $capacity,
                'features' => $features,
                'status' => 'available',
            ]);
        }

        return $hotel;
    }

    private function user(string $email, string $name, string $role, ?Hotel $hotel = null): User
    {
        return User::updateOrCreate(['email' => $email], [
            'name' => $name,
            'password' => $this->passwordHash,
            'role' => $role,
            'hotel_id' => $hotel?->id,
        ]);
    }

    /**
     * Months of history for a hotel that has none yet.
     */
    private function activity(Hotel $hotel, User $admin, array $definition): void
    {
        $this->movements = [];
        $this->subscriptionHistory($hotel, $admin, $definition);
        $this->stays($hotel, $definition['occupancy']);

        if ($hotel->plan_active) {
            $this->credits($hotel, $admin);
            $this->notifyUpcomingStays($hotel);
        }

        $this->applyMovements($hotel);
    }

    /**
     * Paid subscription periods, ending at the current expiry date.
     */
    private function subscriptionHistory(Hotel $hotel, User $admin, array $definition): void
    {
        $plan = config("saas.plans.{$definition['plan']}");
        $days = config('saas.period_days');
        $end = $hotel->plan_expires_at->toImmutable();

        // Gold hotels have been on the platform for longer.
        $periods = $definition['plan'] === 'gold' ? 4 : 3;

        for ($period = $periods - 1; $period >= 0; $period--) {
            $periodEnd = $end->subDays($days * $period);
            $periodStart = $periodEnd->subDays($days);
            $paidAt = $periodStart->subMinutes(30);

            $payment = $this->platformPayment($hotel, $admin, $paidAt, [
                'purpose' => 'subscription',
                'amount' => $plan['price'],
                'description' => "Plan {$plan['name']} de {$hotel->name}, {$days} días",
                'metadata' => [
                    'plan' => $definition['plan'],
                    'period_start' => $periodStart->toISOString(),
                    'period_end' => $periodEnd->toISOString(),
                    'fulfilled_at' => $paidAt->toISOString(),
                ],
            ]);

            $this->ledger($hotel, $paidAt, $plan['monthly_credits'], 'bonus', null,
                "Créditos incluidos en el plan {$plan['name']}", $admin, "payment:{$payment->id}");
        }

        $this->ledger($hotel, $end->subDays($days * $periods)->subHour(), 50, 'bonus', null,
            'Créditos de bienvenida', null, null);
    }

    /**
     * Stays per room, from HISTORY_DAYS ago to FUTURE_DAYS ahead, with their payments.
     */
    private function stays(Hotel $hotel, string $occupancy): void
    {
        $gaps = self::GAPS[$occupancy];
        $counter = 0;

        foreach ($hotel->rooms()->orderBy('number')->get() as $roomIndex => $room) {
            $checkIn = $this->today->subDays(self::HISTORY_DAYS - $roomIndex * 2);

            while ($checkIn->isBefore($this->today->addDays(self::FUTURE_DAYS))) {
                $nights = self::NIGHTS[($counter + $roomIndex) % count(self::NIGHTS)];
                $checkOut = $checkIn->addDays($nights);

                $this->stay($hotel, $room, $checkIn, $checkOut, $counter);

                $checkIn = $checkOut->addDays($gaps[$counter % count($gaps)]);
                $counter++;
            }
        }
    }

    private function stay(Hotel $hotel, Room $room, CarbonImmutable $checkIn, CarbonImmutable $checkOut, int $counter): void
    {
        $guest = $this->guests[($counter * 7 + $room->id) % count($this->guests)];
        $leadDays = [3, 10, 1, 21, 6, 14, 2][$counter % 7];
        $bookedAt = $checkIn->subDays($leadDays)->setTime(9 + $counter % 10, ($counter * 13) % 60);
        $bookedAt = $bookedAt->isAfter(now()) ? now()->subHours(1 + $counter % 20)->toImmutable() : $bookedAt;

        // Every eleventh stay was cancelled and its payment refunded.
        $cancelled = $counter % 11 === 5;
        $cash = $counter % 4 === 3;
        $nights = (int) $checkIn->diffInDays($checkOut);

        $reservation = Reservation::forceCreate([
            'hotel_id' => $hotel->id,
            'user_id' => $guest->id,
            'room_id' => $room->id,
            'check_in' => $checkIn->toDateString(),
            'check_out' => $checkOut->toDateString(),
            'status' => $cancelled ? 'cancelled' : 'confirmed',
            'created_at' => $this->stored($bookedAt),
            'updated_at' => $this->stored($cancelled ? $bookedAt->addDays(1) : $bookedAt),
        ]);

        Payment::forceCreate([
            'reservation_id' => $reservation->id,
            'user_id' => $guest->id,
            'hotel_id' => $hotel->id,
            'purpose' => 'reservation',
            'description' => "{$hotel->name}: habitación {$room->number} ({$room->type})",
            'customer_email' => $guest->email,
            'amount' => number_format((float) $room->price * $nights, 2, '.', ''),
            'currency' => config('services.payments.currency'),
            'method' => $cash ? 'cash' : 'card',
            'status' => $cancelled ? 'refunded' : 'paid',
            'provider' => $cash ? 'manual' : 'stripe',
            'paid_at' => $this->stored($bookedAt->addMinutes(4)),
            'created_at' => $this->stored($bookedAt),
            'updated_at' => $this->stored($cancelled ? $bookedAt->addDays(1) : $bookedAt->addMinutes(4)),
        ]);
    }

    /**
     * Credit purchases and their use: reports, time passes and campaigns.
     */
    private function credits(Hotel $hotel, User $admin): void
    {
        $purchaseAt = $this->today->subDays(40)->setTime(11, 20);
        $payment = $this->platformPayment($hotel, $admin, $purchaseAt, [
            'purpose' => 'credits',
            'amount' => config('saas.credit_packages.business.price'),
            'description' => '150 créditos para '.$hotel->name.' (paquete Negocio)',
            'metadata' => ['package' => 'business', 'credits' => 150, 'fulfilled_at' => $purchaseAt->toISOString()],
        ]);
        $this->ledger($hotel, $purchaseAt, 150, 'purchase', null, 'Compra de 150 créditos', $admin, "payment:{$payment->id}");

        // Reports of the last two months.
        foreach ([2, 1] as $monthsAgo) {
            $from = $this->today->subMonths($monthsAgo)->startOfMonth();
            $to = $from->endOfMonth();
            $at = $to->addDay()->setTime(10, 5);

            $report = Report::forceCreate([
                'hotel_id' => $hotel->id,
                'user_id' => $admin->id,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'data' => (new HotelStats($hotel))->period($from->toDateString(), $to->toDateString()),
                'credits' => config('saas.credit_features.report.cost'),
                'created_at' => $this->stored($at),
                'updated_at' => $this->stored($at),
            ]);
            $this->ledger($hotel, $at, -$report->credits, 'usage', 'report',
                "Reporte de ocupación del {$from->toDateString()} al {$to->toDateString()}", $admin, "report:{$report->id}");
        }

        // A campaign pass used last week, with the campaign it sent.
        $campaignAt = $this->today->subDays(6)->setTime(17, 0);
        $this->pass($hotel, $admin, 'campaigns', 'hours', 1, $campaignAt);
        $this->campaign($hotel, $admin, $campaignAt->addMinutes(10));

        // Analytics open right now for a couple of days.
        $this->pass($hotel, $admin, 'analytics', 'days', 2, now()->subHours(3)->toImmutable());
    }

    private function pass(Hotel $hotel, User $admin, string $feature, string $unit, int $quantity, CarbonImmutable $start): void
    {
        $cost = FeaturePass::cost($feature, $unit, $quantity);
        $units = ['minutes' => 'minutos', 'hours' => $quantity === 1 ? 'hora' : 'horas', 'days' => 'días'][$unit];

        $pass = $hotel->featurePasses()->forceCreate([
            'hotel_id' => $hotel->id,
            'user_id' => $admin->id,
            'feature' => $feature,
            'unit' => $unit,
            'quantity' => $quantity,
            'credits' => $cost,
            'starts_at' => $this->stored($start),
            'expires_at' => $this->stored($start->add($unit, $quantity)),
            'created_at' => $this->stored($start),
            'updated_at' => $this->stored($start),
        ]);

        $name = config("saas.passes.{$feature}.name");
        $this->ledger($hotel, $start, -$cost, 'usage', $feature, "Pase de {$name}: {$quantity} {$units}", $admin, "pass:{$pass->id}");
    }

    private function campaign(Hotel $hotel, User $admin, CarbonImmutable $at): void
    {
        $recipients = User::where('role', 'customer')
            ->whereHas('reservations', fn ($query) => $query
                ->where('hotel_id', $hotel->id)
                ->where('status', 'confirmed')
                ->where('check_out', '<=', $at->toDateString()))
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $campaign = Campaign::forceCreate([
            'hotel_id' => $hotel->id,
            'user_id' => $admin->id,
            'audience' => 'past',
            'title' => '15% de descuento en tu próxima visita',
            'message' => "Gracias por hospedarte en {$hotel->name}. Reserva antes de fin de mes y obtén 15% de descuento en tu siguiente estancia.",
            'recipients' => $recipients->count(),
            'created_at' => $this->stored($at),
            'updated_at' => $this->stored($at),
        ]);

        Notification::send($recipients, new GuestCampaign($hotel, $campaign));
    }

    /**
     * The guest and the hotel's admins get the "reservation confirmed" notification
     * of the next arrivals, so the bells have something to show.
     */
    private function notifyUpcomingStays(Hotel $hotel): void
    {
        $hotel->reservations()
            ->with(['room', 'user', 'latestPayment'])
            ->where('status', 'confirmed')
            ->where('check_in', '>=', $this->today->toDateString())
            ->orderBy('check_in')
            ->limit(3)
            ->get()
            ->each(fn (Reservation $reservation) => ReservationNotifier::confirmed($reservation, $reservation->latestPayment));
    }

    private function platformPayment(Hotel $hotel, User $admin, CarbonImmutable $paidAt, array $attributes): Payment
    {
        return Payment::forceCreate([
            ...$attributes,
            'user_id' => $admin->id,
            'hotel_id' => $hotel->id,
            'customer_email' => $admin->email,
            'currency' => config('services.payments.currency'),
            'method' => 'card',
            'status' => 'paid',
            'provider' => 'stripe',
            'paid_at' => $this->stored($paidAt),
            'created_at' => $this->stored($paidAt->subMinutes(2)),
            'updated_at' => $this->stored($paidAt),
        ]);
    }

    /**
     * Dates are computed in the hotel's time zone; the database stores the app's time zone.
     */
    private function stored(CarbonImmutable $at): CarbonImmutable
    {
        return $at->setTimezone(config('app.timezone'));
    }

    private function ledger(Hotel $hotel, CarbonImmutable $at, int $amount, string $type, ?string $feature, string $description, ?User $user, ?string $reference): void
    {
        if ($amount !== 0) {
            $this->movements[] = compact('at', 'amount', 'type', 'feature', 'description', 'user', 'reference');
        }
    }

    /**
     * Applies the queued credit movements oldest first, through the same methods the
     * app uses, and dates each ledger entry when it happened.
     */
    private function applyMovements(Hotel $hotel): void
    {
        usort($this->movements, fn (array $a, array $b) => $a['at'] <=> $b['at']);

        foreach ($this->movements as $movement) {
            $transaction = $movement['amount'] > 0
                ? $hotel->addCredits($movement['amount'], $movement['type'], $movement['description'], $movement['user'], $movement['reference'])
                : $hotel->spendCredits(-$movement['amount'], $movement['feature'], $movement['description'], $movement['user'], $movement['reference']);

            CreditTransaction::whereKey($transaction->id)->update([
                'created_at' => $this->stored($movement['at']),
                'updated_at' => $this->stored($movement['at']),
            ]);
        }

        $this->movements = [];
    }
}
