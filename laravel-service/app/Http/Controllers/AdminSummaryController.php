<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;

/**
 * Key figures for the admin dashboard: this month's income and invoicing,
 * today's occupancy and movements, and what still needs attention.
 */
class AdminSummaryController extends Controller
{
    private const UPCOMING_DAYS = 7;

    public function __invoke()
    {
        Reservation::expireStale();

        $now = now(config('services.hotel.timezone'));
        $today = $now->toDateString();
        $monthStart = $now->copy()->startOfMonth()->utc();

        $paidThisMonth = Payment::query()
            ->whereNotNull('reservation_id')
            ->where('status', 'paid')
            ->where('paid_at', '>=', $monthStart);

        $refundedThisMonth = Payment::query()
            ->whereNotNull('reservation_id')
            ->where('status', 'refunded')
            ->where('updated_at', '>=', $monthStart);

        $issuedThisMonth = Invoice::query()
            ->where('status', 'issued')
            ->where('issued_at', '>=', $monthStart);

        $confirmed = Reservation::query()->where('status', 'confirmed');

        $occupiedRooms = (clone $confirmed)
            ->where('check_in', '<=', $today)
            ->where('check_out', '>', $today)
            ->distinct()
            ->count('room_id');
        $rooms = Room::where('status', '!=', 'inactive')->count();

        $uninvoicedPayments = Payment::query()
            ->where('status', 'paid')
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', 'confirmed')
                ->whereDoesntHave('invoices', fn ($query) => $query->whereIn('status', ['pending', 'issued'])));

        return response()->json([
            'today' => $today,
            'month' => $now->format('Y-m'),
            'revenue_month' => (float) (clone $paidThisMonth)->sum('amount'),
            'payments_month' => (clone $paidThisMonth)->count(),
            'refunds_month' => (float) (clone $refundedThisMonth)->sum('amount'),
            'invoiced_month' => (float) (clone $issuedThisMonth)->sum('total'),
            'invoices_month' => (clone $issuedThisMonth)->count(),
            'uninvoiced_amount' => (float) (clone $uninvoicedPayments)->sum('amount'),
            'uninvoiced_count' => (clone $uninvoicedPayments)->count(),
            'occupied_rooms' => $occupiedRooms,
            'rooms' => $rooms,
            'occupancy_rate' => $rooms > 0 ? round($occupiedRooms / $rooms * 100, 1) : 0,
            'arrivals_today' => (clone $confirmed)->where('check_in', $today)->count(),
            'departures_today' => (clone $confirmed)->where('check_out', $today)->count(),
            'active_reservations' => (clone $confirmed)->where('check_out', '>', $today)->count(),
            'pending_payments' => Reservation::where('status', 'pending')->count(),
            'upcoming_arrivals' => (clone $confirmed)
                ->whereBetween('check_in', [$today, $now->copy()->addDays(self::UPCOMING_DAYS)->toDateString()])
                ->with(['room', 'user', 'latestPayment'])
                ->orderBy('check_in')
                ->limit(8)
                ->get(),
        ]);
    }
}
