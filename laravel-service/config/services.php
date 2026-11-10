<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'stripe' => [
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'payments' => [
        'driver' => env('PAYMENT_DRIVER', 'stripe'),
        'currency' => env('PAYMENT_CURRENCY', 'mxn'),
        // Minutes a pending reservation holds its dates while the customer pays.
        // Stripe Checkout sessions must stay open at least 30 minutes.
        'hold_minutes' => (int) env('PAYMENT_HOLD_MINUTES', 35),
        'frontend_url' => rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/'),
    ],

    // Shared secret the NestJS gateway sends to internal routes (X-Gateway-Secret).
    'gateway' => [
        'secret' => env('GATEWAY_SECRET'),
    ],

    'hotel' => [
        // Defines "today" and "this month" for the admin dashboard and the invoice dates.
        'timezone' => env('HOTEL_TIMEZONE', 'America/Mexico_City'),
    ],

    // Profact PAC. The defaults point to its test environment and test integrator user.
    'profact' => [
        'wsdl' => env('PROFACT_WSDL', 'https://pruebas.timbracfdi33.mx/Timbrado.asmx?wsdl'),
        'user' => env('PROFACT_USER', 'mvpNUXmQfK8='),
        'verify_ssl' => (bool) env('PROFACT_VERIFY_SSL', false),
    ],

    'invoicing' => [
        'driver' => env('INVOICE_DRIVER', 'profact'),
        'series' => env('INVOICE_SERIES', 'H'),
        // The hotel's fiscal data. The defaults are a SAT test emitter registered in Profact's test environment.
        'emitter' => [
            'rfc' => env('INVOICE_EMITTER_RFC', 'IIA040805DZ4'),
            'name' => env('INVOICE_EMITTER_NAME', 'INDISTRIA ILUMINADORA DE ALMACENES'),
            'tax_regime' => env('INVOICE_EMITTER_TAX_REGIME', '601'),
            'postal_code' => env('INVOICE_EMITTER_POSTAL_CODE', '62661'),
            // SAT product key for hotel lodging.
            'product_code' => env('INVOICE_PRODUCT_CODE', '90111800'),
        ],
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
