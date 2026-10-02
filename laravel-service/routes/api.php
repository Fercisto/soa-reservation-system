<?php

use App\Http\Controllers\AuthController;
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
});
