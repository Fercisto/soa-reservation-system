<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ExternalNotificationController;
use App\Http\Controllers\ExternalPaymentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ReservationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/rooms', [RoomController::class, 'index']);
Route::get('/rooms/available', [RoomController::class, 'available']);
Route::get('/rooms/{room}', [RoomController::class, 'show']);

Route::post('/payments/webhook', [PaymentController::class, 'webhook']);

// Generic payments and notifications APIs for external systems, authenticated with the X-Api-Key header.
Route::prefix('v1')->middleware('api.client')->group(function () {
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
    Route::post('/rooms', [RoomController::class, 'store'])->middleware('role:admin');
    Route::put('/rooms/{room}', [RoomController::class, 'update'])->middleware('role:admin');
    Route::patch('/rooms/{room}/status', [RoomController::class, 'updateStatus'])->middleware('role:admin');
    Route::delete('/rooms/{room}', [RoomController::class, 'destroy'])->middleware('role:admin');
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::patch('/reservations/{reservation}/dates', [ReservationController::class, 'updateDates']);
    Route::patch('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::get('/payments/{payment}', [PaymentController::class, 'show']);
    Route::post('/payments/{payment}/verify', [PaymentController::class, 'verify']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
});
