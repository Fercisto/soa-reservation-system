<?php

namespace App\Saas;

use App\Models\Hotel;
use App\Models\Payment;
use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Occupancy and income figures of a hotel, shared by the PDF report (credits)
 * and the advanced analytics (time pass). Computed in PHP so they work the same on MySQL and SQLite.
 */
class HotelStats
{
    public function __construct(private readonly Hotel $hotel)
    {
    }

    /**
     * Occupancy and income between two dates (both included).
     */
    public function period(string $from, string $to): array
    {
        $start = CarbonImmutable::parse($from)->startOfDay();
        $end = CarbonImmutable::parse($to)->addDay()->startOfDay();
        $days = (int) $start->diffInDays($end);

        $rooms = $this->hotel->rooms()->where('status', '!=', 'inactive')->orderBy('number')->get();
        $stays = $this->confirmedStays($start, $end);

        $byRoom = $rooms->map(function ($room) use ($stays, $days) {
            $roomStays = $stays->where('room_id', $room->id);
            $nights = $roomStays->sum('nights');

            return [
                'number' => $room->number,
                'type' => $room->type,
                'nights' => $nights,
                'occupancy' => $days > 0 ? round($nights / $days * 100, 1) : 0,
                'revenue' => round($roomStays->sum('revenue'), 2),
            ];
        })->values();

        $availableNights = $rooms->count() * $days;
        $bookedNights = $stays->sum('nights');
        $roomRevenue = round($stays->sum('revenue'), 2);

        $reservations = $this->hotel->reservations()
            ->whereBetween('created_at', [$start, $end])
            ->get();

        return [
            'from' => $start->toDateString(),
            'to' => $end->subDay()->toDateString(),
            'days' => $days,
            'rooms' => $rooms->count(),
            'available_nights' => $availableNights,
            'booked_nights' => $bookedNights,
            'occupancy' => $availableNights > 0 ? round($bookedNights / $availableNights * 100, 1) : 0,
            'room_revenue' => $roomRevenue,
            'adr' => $bookedNights > 0 ? round($roomRevenue / $bookedNights, 2) : 0,
            'revpar' => $availableNights > 0 ? round($roomRevenue / $availableNights, 2) : 0,
            'payments_received' => round($this->paidBetween($start, $end)->sum('amount'), 2),
            'refunds' => round($this->refundedBetween($start, $end)->sum('amount'), 2),
            'reservations_created' => $reservations->count(),
            'reservations_cancelled' => $reservations->where('status', 'cancelled')->count(),
            'by_room' => $byRoom,
        ];
    }

    /**
     * Trends for the analytics module: last 12 months, rooms in the last 90 days and guest behavior.
     */
    public function analytics(): array
    {
        $today = CarbonImmutable::now(config('services.hotel.timezone'))->startOfDay();

        $months = collect(range(11, 0))->map(function (int $back) use ($today) {
            $start = $today->startOfMonth()->subMonths($back);
            $end = $start->addMonth();
            $stays = $this->confirmedStays($start, $end);

            return [
                'month' => $start->format('Y-m'),
                'revenue' => round($this->paidBetween($start, $end)->sum('amount'), 2),
                'nights' => $stays->sum('nights'),
            ];
        })->values();

        $last90 = $this->period($today->subDays(90)->toDateString(), $today->subDay()->toDateString());

        $recent = $this->hotel->reservations()
            ->where('created_at', '>=', $today->subDays(90))
            ->whereIn('status', ['confirmed', 'cancelled'])
            ->get();
        $confirmed = $this->hotel->reservations()->where('status', 'confirmed')->get();
        $stayLengths = $confirmed->map(fn (Reservation $reservation) => $reservation->nights());
        $leadTimes = $confirmed->map(
            fn (Reservation $reservation) => max(0, (int) $reservation->created_at->startOfDay()->diffInDays($reservation->check_in, false))
        );
        $staysPerGuest = $confirmed->countBy('user_id');

        return [
            'months' => $months,
            'rooms' => $last90['by_room'],
            'occupancy_90d' => $last90['occupancy'],
            'adr_90d' => $last90['adr'],
            'revpar_90d' => $last90['revpar'],
            'average_stay' => round($stayLengths->avg() ?? 0, 1),
            'average_lead_time' => round($leadTimes->avg() ?? 0, 1),
            'cancellation_rate' => $recent->count() > 0
                ? round($recent->where('status', 'cancelled')->count() / $recent->count() * 100, 1)
                : 0,
            'guests' => $staysPerGuest->count(),
            'repeat_guest_rate' => $staysPerGuest->count() > 0
                ? round($staysPerGuest->filter(fn (int $stays) => $stays > 1)->count() / $staysPerGuest->count() * 100, 1)
                : 0,
        ];
    }

    /**
     * Confirmed reservations overlapping [start, end), with the nights and room revenue inside it.
     */
    private function confirmedStays(CarbonImmutable $start, CarbonImmutable $end): Collection
    {
        return $this->hotel->reservations()
            ->with('room')
            ->where('status', 'confirmed')
            ->where('check_in', '<', $end->toDateString())
            ->where('check_out', '>', $start->toDateString())
            ->get()
            ->map(function (Reservation $reservation) use ($start, $end) {
                $from = max($reservation->check_in->getTimestamp(), $start->getTimestamp());
                $to = min($reservation->check_out->getTimestamp(), $end->getTimestamp());
                $nights = (int) round(($to - $from) / 86400);

                return [
                    'room_id' => $reservation->room_id,
                    'nights' => $nights,
                    'revenue' => $nights * (float) $reservation->room->price,
                ];
            });
    }

    private function paidBetween(CarbonImmutable $start, CarbonImmutable $end)
    {
        return Payment::query()
            ->whereHas('reservation', fn ($query) => $query->where('hotel_id', $this->hotel->id))
            ->whereIn('status', ['paid', 'refunded'])
            ->where('paid_at', '>=', $start->utc())
            ->where('paid_at', '<', $end->utc())
            ->get();
    }

    private function refundedBetween(CarbonImmutable $start, CarbonImmutable $end)
    {
        return Payment::query()
            ->whereHas('reservation', fn ($query) => $query->where('hotel_id', $this->hotel->id))
            ->where('status', 'refunded')
            ->where('updated_at', '>=', $start->utc())
            ->where('updated_at', '<', $end->utc())
            ->get();
    }
}
