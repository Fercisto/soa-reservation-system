<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Saas\HotelStats;
use App\Saas\InsufficientCreditsException;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Occupancy and income report in PDF, charged in credits. A generated report is kept,
 * so it can be downloaded again without paying twice.
 */
class ReportController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            Report::where('hotel_id', $request->user()->hotel_id)
                ->with('user:id,name')
                ->latest('id')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);

        if (now()->parse($validated['from'])->diffInDays($validated['to']) > 366) {
            return response()->json(['message' => 'A report can cover up to one year.'], 422);
        }

        $hotel = $request->user()->hotel;
        $cost = (int) config('saas.credit_features.report.cost');

        try {
            $report = DB::transaction(function () use ($hotel, $request, $validated, $cost) {
                $report = $hotel->hasMany(Report::class)->create([
                    'user_id' => $request->user()->id,
                    'from' => $validated['from'],
                    'to' => $validated['to'],
                    'data' => (new HotelStats($hotel))->period($validated['from'], $validated['to']),
                    'credits' => $cost,
                ]);

                $hotel->spendCredits(
                    $cost,
                    'report',
                    "Reporte de ocupación del {$validated['from']} al {$validated['to']}",
                    $request->user(),
                    "report:{$report->id}"
                );

                return $report;
            });
        } catch (InsufficientCreditsException $exception) {
            return response()->json([
                'message' => "Not enough credits: {$exception->required} required, {$exception->balance} available. Buy a credit package.",
            ], 402);
        }

        return response()->json($report->load('user:id,name'), 201);
    }

    public function show(Request $request, Report $report)
    {
        return response()->json($this->owned($request, $report)->load('user:id,name'));
    }

    public function pdf(Request $request, Report $report)
    {
        $report = $this->owned($request, $report);

        return Pdf::loadView('reports.occupancy', [
            'report' => $report,
            'hotel' => $report->hotel,
            'data' => $report->data,
        ])->download("reporte-{$report->from->toDateString()}-{$report->to->toDateString()}.pdf");
    }

    private function owned(Request $request, Report $report): Report
    {
        abort_unless($report->hotel_id === $request->user()->hotel_id, 404, 'Report not found.');

        return $report;
    }
}
