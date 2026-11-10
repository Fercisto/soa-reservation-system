<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Reporte de ocupación e ingresos</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; color: #202522; font-family: Helvetica, Arial, sans-serif; font-size: 11px; }
        header { padding-bottom: 12px; border-bottom: 2px solid #235b46; }
        header span { color: #68706a; }
        h1 { margin: 2px 0 0; font-size: 20px; }
        h2 { margin: 22px 0 8px; font-size: 13px; }
        .kpis { width: 100%; margin-top: 16px; border-collapse: separate; border-spacing: 6px 0; }
        .kpis td { width: 25%; padding: 10px 12px; border: 1px solid #d9dcd5; vertical-align: top; }
        .kpis span { display: block; color: #59625c; font-size: 10px; }
        .kpis strong { display: block; margin-top: 4px; font-size: 16px; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th { padding: 7px 8px; color: #59625c; background: #f0f1ed; font-size: 10px; text-align: left; }
        table.data td { padding: 7px 8px; border-top: 1px solid #e5e7e2; }
        .num, table.data th.num { text-align: right; }
        .bar { height: 6px; background: #dcecdf; }
        .bar div { height: 6px; background: #235b46; }
        footer { margin-top: 24px; color: #8a918b; font-size: 9px; }
    </style>
</head>
<body>
    @php
        $money = fn ($value) => '$'.number_format((float) $value, 2);
    @endphp

    <header>
        <span>{{ $hotel->name }} · {{ $hotel->city }}</span>
        <h1>Reporte de ocupación e ingresos</h1>
        <span>Del {{ $data['from'] }} al {{ $data['to'] }} ({{ $data['days'] }} días)</span>
    </header>

    <table class="kpis">
        <tr>
            <td><span>Ocupación</span><strong>{{ $data['occupancy'] }}%</strong></td>
            <td><span>Ingreso por habitaciones</span><strong>{{ $money($data['room_revenue']) }}</strong></td>
            <td><span>Tarifa promedio (ADR)</span><strong>{{ $money($data['adr']) }}</strong></td>
            <td><span>Ingreso por habitación disponible (RevPAR)</span><strong>{{ $money($data['revpar']) }}</strong></td>
        </tr>
    </table>

    <h2>Resumen del periodo</h2>
    <table class="data">
        <tr><td>Habitaciones en operación</td><td class="num">{{ $data['rooms'] }}</td></tr>
        <tr><td>Noches disponibles</td><td class="num">{{ $data['available_nights'] }}</td></tr>
        <tr><td>Noches vendidas</td><td class="num">{{ $data['booked_nights'] }}</td></tr>
        <tr><td>Pagos recibidos</td><td class="num">{{ $money($data['payments_received']) }}</td></tr>
        <tr><td>Reembolsos</td><td class="num">{{ $money($data['refunds']) }}</td></tr>
        <tr><td>Reservaciones creadas</td><td class="num">{{ $data['reservations_created'] }}</td></tr>
        <tr><td>Reservaciones canceladas</td><td class="num">{{ $data['reservations_cancelled'] }}</td></tr>
    </table>

    <h2>Ocupación por habitación</h2>
    <table class="data">
        <thead>
            <tr>
                <th>Habitación</th>
                <th>Tipo</th>
                <th class="num">Noches</th>
                <th style="width: 30%">Ocupación</th>
                <th class="num">Ingreso</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($data['by_room'] as $room)
                <tr>
                    <td>{{ $room['number'] }}</td>
                    <td>{{ $room['type'] }}</td>
                    <td class="num">{{ $room['nights'] }}</td>
                    <td>
                        <div class="bar">@if ($room['occupancy'] > 0)<div style="width: {{ min(100, $room['occupancy']) }}%"></div>@endif</div>
                        {{ $room['occupancy'] }}%
                    </td>
                    <td class="num">{{ $money($room['revenue']) }}</td>
                </tr>
            @empty
                <tr><td colspan="5">El hotel no tiene habitaciones en operación.</td></tr>
            @endforelse
        </tbody>
    </table>

    <footer>
        Generado el {{ $report->created_at->timezone(config('services.hotel.timezone'))->format('Y-m-d H:i') }}
        por {{ $report->user?->name ?? 'el administrador' }} · {{ $report->credits }} créditos ·
        Ingreso por habitaciones = noches vendidas × tarifa de la habitación.
    </footer>
</body>
</html>
