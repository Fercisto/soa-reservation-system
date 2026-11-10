<?php

/*
|--------------------------------------------------------------------------
| SaaS platform
|--------------------------------------------------------------------------
|
| Hotels subscribe to a plan to manage their hotel, buy credits for the
| pay-per-use modules and spend credits on time passes. Prices are in MXN.
|
*/

return [

    // Days a paid subscription period lasts.
    'period_days' => (int) env('SAAS_PERIOD_DAYS', 30),

    // Modules every plan includes, in display order. Each plan includes the previous one.
    'plans' => [
        'bronze' => [
            'name' => 'Bronze',
            'price' => 499,
            'room_limit' => 10,
            'monthly_credits' => 0,
            'features' => ['rooms', 'reservations', 'payments', 'notifications'],
        ],
        'silver' => [
            'name' => 'Silver',
            'price' => 999,
            'room_limit' => 30,
            'monthly_credits' => 0,
            'features' => ['rooms', 'reservations', 'payments', 'notifications', 'overview', 'staff'],
        ],
        'gold' => [
            'name' => 'Gold',
            'price' => 1999,
            'room_limit' => null,
            'monthly_credits' => 50,
            'features' => ['rooms', 'reservations', 'payments', 'notifications', 'overview', 'staff', 'restaurant'],
        ],
    ],

    'credit_packages' => [
        'starter' => ['name' => 'Inicial', 'credits' => 50, 'price' => 199],
        'business' => ['name' => 'Negocio', 'credits' => 150, 'price' => 499],
        'pro' => ['name' => 'Pro', 'credits' => 400, 'price' => 999],
    ],

    // Modules charged per use.
    'credit_features' => [
        'invoice' => ['name' => 'Facturación CFDI', 'cost' => 1, 'unit' => 'factura timbrada'],
        'report' => ['name' => 'Reporte PDF de ocupación e ingresos', 'cost' => 3, 'unit' => 'reporte'],
    ],

    // Modules accessed for a time window. Rates are credits per unit; minutes are sold in blocks.
    'passes' => [
        'analytics' => [
            'name' => 'Analítica avanzada',
            'rates' => ['minutes' => 1, 'hours' => 2, 'days' => 10],
        ],
        'campaigns' => [
            'name' => 'Campañas a huéspedes',
            'rates' => ['minutes' => 1, 'hours' => 3, 'days' => 15],
        ],
    ],

    'minutes_block' => 15,

    // Quantity allowed per unit when buying a pass.
    'pass_limits' => [
        'minutes' => ['min' => 15, 'max' => 240],
        'hours' => ['min' => 1, 'max' => 72],
        'days' => ['min' => 1, 'max' => 30],
    ],

];
