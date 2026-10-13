<?php

use App\Models\ApiClient;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('api-client:create {name} {--callback-url= : URL that receives payment status changes}', function (string $name) {
    [$client, $apiKey] = ApiClient::register($name, $this->option('callback-url'));

    $this->info("API client \"{$client->name}\" created (id {$client->id}).");
    $this->line("API key:         {$apiKey}");
    $this->line("Callback secret: {$client->callback_secret}");
    $this->warn('Save the API key now: it is stored hashed and cannot be shown again.');
})->purpose('Register an external system that can use the payments API');
