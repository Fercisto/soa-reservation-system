# SOA Reservation System

A Service-Oriented Architecture (SOA) project developed as an academic project to demonstrate communication between React, NestJS, and Laravel services.

## Overview

The system is a hotel room reservation application split into three independent services:

* **React frontend** (`soa-frontend`) – user interface. It talks **only** to NestJS, using **GraphQL**.
* **NestJS gateway** (`nest-client`) – exposes a GraphQL API (and legacy REST endpoints) and forwards every operation to Laravel over **REST**.
* **Laravel service** (`laravel-service`) – owns the business rules, authentication, and the database.

The purpose of the project is to demonstrate interoperability between different technologies and protocols.

## Architecture

```text
┌───────────────────┐
│   React Frontend  │
│   soa-frontend    │
└─────────┬─────────┘
          │
          │ GraphQL (POST /graphql)
          ▼
┌───────────────────┐
│      NestJS       │
│   nest-client     │
│                   │
│  GraphQL Gateway  │
└─────────┬─────────┘
          │
          │ REST API (JSON)
          ▼
┌───────────────────┐
│  Laravel Service  │
│   PHP / Laravel   │
│                   │
│  Business Logic   │
│  Authentication   │
│  Rooms            │
│  Reservations     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   MySQL Database  │
└───────────────────┘
```

## Services

### Laravel Service

Laravel is the main backend service and contains the core business logic.

Responsibilities:

* User registration, login and logout (Laravel Sanctum tokens)
* Roles: `admin` and `customer`
* Room management (admin only for create / update / delete / status changes)
* Reservation management with date-conflict detection
* Database operations

#### REST endpoints (`/api`)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/register` | – | Create a customer account and return a token |
| POST | `/login` | – | Return a token |
| POST | `/logout` | token | Revoke the current token |
| GET | `/me` | token | Current user |
| GET | `/rooms` | – | All rooms |
| GET | `/rooms/available?check_in=&check_out=` | – | Rooms with status `available`; if both dates are given, rooms with an overlapping reservation are excluded |
| GET | `/rooms/{id}` | – | Room detail |
| POST | `/rooms` | admin | Create room |
| PUT | `/rooms/{id}` | admin | Update room |
| PATCH | `/rooms/{id}/status` | admin | Change room status |
| DELETE | `/rooms/{id}` | admin | Delete room (only if it has no reservations) |
| GET | `/reservations` | token | Own reservations (admin: all reservations) |
| POST | `/reservations` | token | Create reservation |
| GET | `/reservations/{id}` | token | Reservation detail |
| PATCH | `/reservations/{id}/dates` | token | Change reservation dates |
| PATCH | `/reservations/{id}/cancel` | token | Cancel reservation |

#### Business rules

* Room status is one of `available`, `occupied`, `maintenance`, `inactive`.
* A reservation can only be created or moved if the room status is `available`.
* `check_in` cannot be in the past and `check_out` must be after `check_in`.
* Two non-cancelled reservations for the same room cannot overlap.
* Customers can only see and modify their own reservations; admins can see, modify and cancel any reservation.
* Cancelled reservations cannot be modified.

### NestJS Gateway

NestJS is the intermediary between the frontend and Laravel. It does not contain business rules.

Responsibilities:

* Exposing a GraphQL API at `/graphql` (Apollo, playground enabled)
* Validating the `Authorization` header by asking Laravel (`GET /api/me`) before protected operations
* Forwarding the token and data to Laravel's REST API
* Translating Laravel errors into GraphQL errors (e.g. HTTP 401 → `UNAUTHENTICATED`)

#### GraphQL operations

| Type | Operation | Auth |
| ---- | --------- | ---- |
| Mutation | `login(input)`, `register(input)` | – |
| Mutation | `logout` | token |
| Query | `me` | token |
| Query | `rooms`, `room(id)`, `availableRooms(checkIn, checkOut)` | – |
| Mutation | `createRoom`, `updateRoom`, `updateRoomStatus`, `deleteRoom` | admin |
| Query | `reservations`, `reservation(id)` | token |
| Mutation | `createReservation`, `updateReservationDates`, `cancelReservation` | token |

The equivalent legacy REST routes (`/auth/*`, `/rooms/*`, `/reservations/*`) are still available in NestJS.

### React Frontend

The frontend is built with React and Vite.

Features:

* Login and registration
* **Customer view:** list available rooms, create reservations, view and cancel own reservations
* **Admin view:** create, edit and delete rooms; view and cancel active reservations
* Logout revokes the token in Laravel
* If the stored token is expired or invalid, the session is cleared and the user is sent back to the login screen

The frontend never communicates directly with Laravel.

## Authentication

Authentication is handled by Laravel Sanctum.

```text
React ──login mutation──▶ NestJS ──POST /api/login──▶ Laravel
React ◀──────token─────── NestJS ◀──────token──────── Laravel
```

For protected requests the token is sent in the `Authorization` header and forwarded by NestJS to Laravel:

```text
Authorization: Bearer <token>
```

The session (token and user) is stored in the browser's `localStorage` under `soa-session`.

## Running the project

Requirements: PHP 8.2+, Composer, MySQL, Node.js 20+.

### 1. Laravel (port 8000)

```bash
cd laravel-service
composer install
cp .env.example .env        # configure DB_* for your MySQL instance
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

The seeder creates two demo users (password `password`):

| Email | Role |
| ----- | ---- |
| `admin@example.com` | admin |
| `customer@example.com` | customer |

### 2. NestJS (port 3000)

```bash
cd nest-client
npm install
npm run start:dev
```

Environment variables:

* `PORT` – default `3000`
* `AUTH_SERVICE_URL` – Laravel API base URL, default `http://127.0.0.1:8000/api` (used for auth, rooms and reservations)

GraphQL playground: <http://localhost:3000/graphql>

### 3. React (Vite dev server)

```bash
cd soa-frontend
npm install
npm run dev
```

Environment variables:

* `VITE_API_URL` – NestJS base URL, default `http://localhost:3000`

## Tests

```bash
cd laravel-service && php artisan test   # requires a MySQL database named "testing" (see phpunit.xml)
cd nest-client && npm test
```

## Technologies

* PHP, Laravel, Laravel Sanctum
* Node.js, NestJS, Apollo GraphQL, Axios
* React, Vite
* GraphQL, REST, HTTP, JSON
* MySQL

## Project Structure

```text
soa/
├── laravel-service/   # Laravel REST API: business logic, auth, database
├── nest-client/       # NestJS GraphQL gateway
├── soa-frontend/      # React + Vite frontend
├── .gitignore
└── README.md
```

## Academic Project

This project was developed as part of a Service-Oriented Architecture (SOA) course.

The main objective is to demonstrate interoperability between different technologies by connecting React, NestJS and Laravel through GraphQL and REST APIs, while Laravel keeps the business logic and data management.
