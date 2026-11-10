<?php

use App\Http\Controllers\AdminSummaryController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\CampaignController;
use App\Http\Controllers\ExternalClientSettingsController;
use App\Http\Controllers\ExternalNotificationController;
use App\Http\Controllers\ExternalPaymentController;
use App\Http\Controllers\HotelController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ReservationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// SaaS platform: catalog of plans, hotel sign-up and the hotels guests can book.
Route::get('/plans', [HotelController::class, 'plans']);
Route::post('/hotels', [HotelController::class, 'register']);
Route::get('/hotels', [HotelController::class, 'index']);
Route::get('/hotels/{slug}', [HotelController::class, 'show']);
Route::get('/hotels/{slug}/rooms/available', [HotelController::class, 'availableRooms']);
Route::get('/rooms/{room}', [RoomController::class, 'show'])->whereNumber('room');

// Internal routes for the NestJS gateway (X-Gateway-Secret).
Route::get('/internal/hotels/{slug}/restaurant', [HotelController::class, 'restaurantCredentials'])->middleware('gateway');

Route::post('/payments/webhook', [PaymentController::class, 'webhook']);

// Generic payments and notifications APIs for external systems, authenticated with the X-Api-Key header.
Route::prefix('v1')->middleware('api.client')->group(function () {
    Route::get('/settings', [ExternalClientSettingsController::class, 'show']);
    Route::put('/settings', [ExternalClientSettingsController::class, 'update']);
    Route::get('/payments', [ExternalPaymentController::class, 'index']);
    Route::post('/payments', [ExternalPaymentController::class, 'store']);
    Route::get('/payments/{payment}', [ExternalPaymentController::class, 'show'])->whereNumber('payment');
    Route::post('/payments/{payment}/verify', [ExternalPaymentController::class, 'verify'])->whereNumber('payment');
    Route::post('/payments/{payment}/cancel', [ExternalPaymentController::class, 'cancel'])->whereNumber('payment');
    Route::post('/payments/{payment}/refund', [ExternalPaymentController::class, 'refund'])->whereNumber('payment');

    Route::get('/notifications', [ExternalNotificationController::class, 'index']);
    Route::post('/notifications', [ExternalNotificationController::class, 'store']);
    Route::patch('/notifications/read-all', [ExternalNotificationController::class, 'markAllAsRead']);
    Route::get('/notifications/{notification}', [ExternalNotificationController::class, 'show'])->whereUuid('notification');
    Route::patch('/notifications/{notification}/read', [ExternalNotificationController::class, 'markAsRead'])->whereUuid('notification');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::patch('/reservations/{reservation}/dates', [ReservationController::class, 'updateDates']);
    Route::patch('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::get('/payments/{payment}', [PaymentController::class, 'show']);
    Route::post('/payments/{payment}/verify', [PaymentController::class, 'verify']);
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices', [InvoiceController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
    Route::post('/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);

    // The admin's hotel and its account with the platform; open with an expired plan so it can renew.
    Route::middleware('hotel')->group(function () {
        Route::get('/hotel', [HotelController::class, 'mine']);
        Route::put('/hotel', [HotelController::class, 'update']);
        Route::get('/billing/payments', [BillingController::class, 'payments']);
        Route::post('/billing/subscription', [BillingController::class, 'subscribe']);
        Route::post('/billing/credits', [BillingController::class, 'buyCredits']);
        Route::post('/billing/payments/{payment}/verify', [BillingController::class, 'verify']);
        Route::get('/billing/transactions', [BillingController::class, 'transactions']);
        Route::get('/billing/passes', [BillingController::class, 'passes']);
        Route::post('/billing/passes', [BillingController::class, 'buyPass']);
    });

    // Modules of the plan.
    Route::middleware('hotel:active')->group(function () {
        Route::get('/rooms', [RoomController::class, 'index']);
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::put('/rooms/{room}', [RoomController::class, 'update']);
        Route::patch('/rooms/{room}/status', [RoomController::class, 'updateStatus']);
        Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);

        // Charged in credits.
        Route::get('/reports', [ReportController::class, 'index']);
        Route::post('/reports', [ReportController::class, 'store']);
        Route::get('/reports/{report}', [ReportController::class, 'show']);
        Route::get('/reports/{report}/pdf', [ReportController::class, 'pdf']);
    });

    Route::get('/admin/summary', AdminSummaryController::class)->middleware('hotel:feature,overview');

    // Accessed with a time pass.
    Route::get('/analytics', AnalyticsController::class)->middleware('hotel:pass,analytics');
    Route::get('/campaigns', [CampaignController::class, 'index'])->middleware('hotel:pass,campaigns');
    Route::post('/campaigns', [CampaignController::class, 'store'])->middleware('hotel:pass,campaigns');
});
