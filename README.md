# SOA Reservation System

A Service-Oriented Architecture (SOA) project developed as an academic project to demonstrate communication between React, NestJS, and Laravel services.

## Overview

The system is a hotel room reservation application split into three independent services:

* **React frontend** (`soa-frontend`) – user interface. It talks **only** to NestJS, using **GraphQL**.
* **NestJS gateway** (`nest-client`) – exposes a GraphQL API and forwards every operation to Laravel over **REST**.
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
│  Payments ────────┼──▶ Stripe Checkout
│  Invoices ────────┼──▶ Profact PAC (SOAP) ──▶ SAT
│  Notifications    │
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
* Payment registration and verification through Stripe Checkout
* Electronic invoices (CFDI 4.0) for paid reservations, stamped with the Profact PAC
* In-app notifications (Laravel Notifications, `database` channel) for reservation events
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
| POST | `/reservations` | token | Reserve and start the card payment: returns the `pending` reservation with `latest_payment.checkout_url` |
| GET | `/reservations/{id}` | token | Reservation detail |
| PATCH | `/reservations/{id}/dates` | token | Change dates (only reservations without a payment in progress or completed) |
| PATCH | `/reservations/{id}/cancel` | token | Cancel reservation: closes an open checkout or refunds a paid payment |
| GET | `/payments?status=&reservation_id=` | token | Own payments (admin: all payments) |
| POST | `/payments` | token | Pay a reservation: `card` returns the open Stripe Checkout session (or creates a new one), `cash` (admin only) is registered as paid |
| GET | `/payments/{id}` | token | Payment detail |
| POST | `/payments/{id}/verify` | token | Ask Stripe for the payment status and confirm the reservation if paid |
| POST | `/payments/webhook` | Stripe signature | Stripe webhook (`checkout.session.*` events) |
| GET | `/invoices?status=&reservation_id=` | token | Own invoices (admin: all invoices) |
| POST | `/invoices` | token | Invoice a paid reservation with the customer's fiscal data |
| GET | `/invoices/{id}` | token | Invoice detail with the stamped `xml` and `qr_code` |
| POST | `/invoices/{id}/cancel` | token | Cancel the CFDI with the SAT; the reservation stays paid and can be invoiced again |
| GET | `/admin/summary` | admin | Dashboard KPIs: month income, refunds and invoicing, today's occupancy, arrivals and departures, pending payments, paid but not invoiced, upcoming arrivals |
| GET | `/notifications?unread=&limit=` | token | Current user's notifications (newest first) and `unread_count` |
| PATCH | `/notifications/{id}/read` | token | Mark one notification as read |
| PATCH | `/notifications/read-all` | token | Mark all notifications as read |

#### Business rules

* Room status is one of `available`, `occupied`, `maintenance`, `inactive`.
* A reservation can only be created or moved if the room status is `available`.
* `check_in` cannot be in the past and `check_out` must be after `check_in`.
* Two non-cancelled reservations for the same room cannot overlap.
* Customers can only see and modify their own reservations; admins can see, modify and cancel any reservation.
* Cancelled reservations cannot be modified.
* Reserving and paying is one step: a new reservation starts as `pending` with a payment window (`expires_at`, `PAYMENT_HOLD_MINUTES`, 35 by default) and becomes `confirmed` when its payment is `paid`.
* A `pending` reservation blocks its dates. If it is not paid in time it becomes `expired` and the dates are released (checked on every reservation, availability and payment request, so no cron job is needed). A 10-minute grace period lets a payment made right before the deadline still be confirmed.
* Only `pending` and `confirmed` reservations block dates.
* The payment amount is computed on the server: room price × nights.
* A reservation can only have one paid payment; reservations with a payment in progress or completed cannot change dates.
* Cancelling a paid reservation refunds the payment (status `refunded`) and cancels its invoice with the SAT.
* Only `confirmed` reservations with a `paid` payment can be invoiced, once.

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
| Query | `payments(status, reservationId)`, `payment(id)` | token |
| Mutation | `createPayment(input)`, `verifyPayment(id)` | token |
| Query | `invoices(status, reservationId)`, `invoice(id)` (with `xml` and `qr_code`) | token |
| Mutation | `requestInvoice(input)`, `cancelInvoice(id)` | token |
| Query | `adminSummary` | admin |
| Query | `notifications(unreadOnly, limit)` → `{ unread_count, notifications }` | token |
| Mutation | `markNotificationAsRead(id)`, `markAllNotificationsAsRead` | token |

`Reservation` also exposes `latest_payment` and `invoice` so clients can show whether a reservation is paid and invoiced.

### React Frontend

The frontend is built with React and Vite.

Features:

* Login and registration
* **Customer view**, with a menu of four sections:
  * **Reservar:** available rooms for the chosen dates; reserve and pay with Stripe in one step
  * **Mis reservaciones:** resume a pending payment, cancel, and request or open the invoice of a paid reservation
  * **Restaurante:** the hotel restaurant menu
  * **Facturas:** own invoices; download the XML or print / save as PDF
* **Admin view:** **Resumen** tab with KPIs (income and occupancy, arrivals, pending payments, invoicing, upcoming arrivals); create, edit and delete rooms; view active reservations with their payment status, register cash payments and cancel reservations; list every invoice (tab **Facturas**)
* Notification bell in the header with an unread badge; it refreshes every 30 seconds and after paying or cancelling
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

## Payments

The payments service lives in Laravel and uses **Stripe Checkout** in test mode. Stripe hosts the card form, so card data never touches this system.

```text
Payment status:      pending ──paid──▶ paid ──reservation cancelled──▶ refunded
                         └──checkout cancelled / expired──▶ failed
Reservation status:  pending ──payment paid──▶ confirmed ──cancel──▶ cancelled
                         ├──cancel──▶ cancelled
                         └──not paid in time──▶ expired
```

Reserve-and-pay flow:

1. The customer calls `createReservation`. Laravel checks the dates, creates a `pending` reservation with `expires_at`, computes the amount, and creates a Stripe Checkout session that closes at the same time. The response includes `latest_payment.checkout_url`.
2. The frontend redirects the customer to `checkout_url`. In test mode, use the card `4242 4242 4242 4242`, any future expiry date and any CVC.
3. Stripe redirects back to the frontend:
   * **Paid:** `FRONTEND_URL/?payment=success&payment_id=<id>`. The frontend calls `verifyPayment(id)`, Laravel asks Stripe for the session status, the payment becomes `paid` and the reservation `confirmed`. The `checkout.session.completed` webhook does the same if configured.
   * **Cancelled:** `FRONTEND_URL/?payment=cancelled&payment_id=<id>`. The frontend cancels the reservation, Laravel closes the Stripe session and the dates are free again.
4. If the customer closes the tab, the reservation can still be paid from "Mis reservaciones" until `expires_at` (`createPayment` returns the same open checkout). After that it becomes `expired`.

Payment providers are behind the `App\Payments\PaymentGateway` interface. `PAYMENT_DRIVER=stripe` uses `StripeGateway`; `PAYMENT_DRIVER=fake` uses an offline gateway that approves every payment, which the test suite uses.

### Receiving webhooks locally (optional)

`verifyPayment` is enough for a local demo. To also receive webhooks, install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to http://127.0.0.1:8000/api/payments/webhook
```

Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Invoices (CFDI 4.0)

Paid reservations can be invoiced with the **Profact** PAC (`timbracfdi33.mx`, SOAP). Laravel builds the CFDI 4.0 XML, Profact seals it with the emitter's CSD registered in its platform and stamps it with the SAT, and returns the stamped XML with its UUID (folio fiscal) and the verification QR code.

```text
React "Facturar" ──requestInvoice──▶ NestJS ──POST /api/invoices──▶ Laravel ──TimbraCFDI (SOAP)──▶ Profact ──▶ SAT
```

1. On a `confirmed` reservation with a `paid` payment, the customer clicks **Facturar** and enters RFC, name, fiscal postal code, tax regime and CFDI use (`G03` or `S01`). The form is filled with the customer's last invoice.
2. Laravel builds an income CFDI (`TipoDeComprobante="I"`, `MetodoPago="PUE"`, `FormaPago` `04` card or `01` cash) with one concept, SAT key `90111800` (hotel lodging). The amount paid already includes 16% VAT; it is split so that subtotal + VAT equals the amount paid.
3. Profact answers with the stamped XML or with the SAT error, which is shown to the customer (e.g. `CFDI40143 - Este RFC del receptor no existe...`). A rejected request leaves nothing saved, so the customer can correct the data and try again.
4. The customer receives a "Factura emitida" notification and the admins a "Nueva factura" one. The customer can open the invoice: printed representation with the QR code, **Descargar XML** and **Imprimir o guardar PDF**.
5. An invoice with wrong data can be cancelled from its detail (**Cancelar factura**, by the customer or an admin). The reservation stays paid and shows **Facturar de nuevo**. Profact answers code `330203` for a CFDI the SAT has not registered yet (usually the first minute after stamping); the customer is asked to try again in a few minutes.
6. Cancelling a paid reservation also cancels the CFDI (`CancelaCFDI40`, reason `02`). A CFDI stamped minutes ago may not be registered with the SAT yet; the cancellation is then retried every time invoices are listed.

Invoicing providers are behind `App\Invoicing\InvoiceGateway`: `INVOICE_DRIVER=profact` uses `ProfactGateway` and `INVOICE_DRIVER=fake` an offline gateway used by the test suite.

**Test environment:** by default the service uses Profact's test URL, its test integrator user (`mvpNUXmQfK8=`) and the SAT test emitter `IIA040805DZ4`. In this environment the SAT only accepts its test RFCs as customers, for example:

| RFC | Name | Regime | Postal code |
| --- | ---- | ------ | ----------- |
| `MISC491214B86` | CECILIA MIRANDA SANCHEZ | 612 | 01010 |
| `XAMA620210DQ5` | ALBA XKARAJAM MENDEZ | 612 | 01219 |
| `EKU9003173C9` | ESCUELA KEMPER URGATE | 601 | 42501 |

The name, regime and postal code must match the SAT list exactly. Profact's integration kit is not part of the repository.

## Notifications

Notifications are sent with Laravel Notifications and stored only in the `notifications` table (`database` channel). No email is sent; users read them from the bell in the header.

| Event | Customer | Admins |
| ----- | -------- | ------ |
| Reservation confirmed (payment `paid`, card or cash) | "Reservación confirmada" with the amount paid | "Nueva reservación" with the customer, room, dates and amount |
| Invoice cancelled | "Factura cancelada", when an admin cancelled it | "Factura cancelada", saying who cancelled it; the admin who cancelled it is not notified |
| Invoice issued | "Factura emitida" with the amount and the name on the invoice | "Nueva factura" with the customer, RFC and folio; an admin who issued it is not notified |
| Confirmed reservation cancelled | "Reservación cancelada", with the refund (card refund or cash to pick up) | "Reservación cancelada", saying who cancelled it and the refund; the admin who cancelled it is not notified |

Pending reservations that are abandoned at checkout or expire do not create notifications, so admins are only notified about real (paid) reservations.

The flow follows the same path as the rest of the system:

```text
Reservations / Payments (Laravel) ──▶ notifications table
React bell ──GraphQL──▶ NestJS ──REST──▶ GET /api/notifications
```

The classes are in `laravel-service/app/Notifications`: `ReservationConfirmed`, `ReservationCancelled` and `ReservationNotifier`, which decides who receives each notification.

## External services consumed (restaurant system)

The hotel consumes two services of a classmate's restaurant system (Java microservices). They are multi-tenant: the hotel identifies itself with an API key and only sees and manages its own data.

| Service | Port | Used for |
| ------- | ---- | -------- |
| `menu-service` | 8083 | Hotel restaurant menu: categories and dishes |
| `employee-service` | 8084 | Hotel staff and their shifts |

```text
React ──GraphQL──▶ NestJS ──REST + X-Api-Key──▶ menu-service / employee-service
```

NestJS calls them from `src/restaurant` and exposes:

| Type | Operation | Who |
| ---- | --------- | --- |
| Query | `menuCategories`, `menuDishes(categoryId)` | Any signed-in user |
| Mutation | `createMenuCategory`, `updateMenuCategory`, `deleteMenuCategory`, `createDish`, `updateDish`, `deleteDish` | Admin |
| Query | `employees(role, shift, active)`, `employeeRoles`, `employeeShifts` | Admin |
| Mutation | `createEmployee`, `updateEmployee`, `deleteEmployee` | Admin |

The frontend shows them in the admin panel (tabs **Menú** and **Personal**) and in the customer panel (section **Restaurante**, available dishes only).

Configuration in `nest-client/.env` (see `nest-client/.env.example`; the file is loaded automatically and ignored by git):

```env
RESTAURANT_MENU_URL=http://<RESTAURANT-IP>:8083/api/v1/menu
RESTAURANT_EMPLOYEES_URL=http://<RESTAURANT-IP>:8084/api/v1/employees
RESTAURANT_API_KEY=<key provided by the restaurant system>
```

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

Payment variables in `laravel-service/.env`:

| Variable | Description |
| -------- | ----------- |
| `STRIPE_SECRET` | Stripe secret key (`sk_test_...`), from *Developers → API keys* in the Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`), optional |
| `PAYMENT_DRIVER` | `stripe` (default) or `fake` |
| `PAYMENT_CURRENCY` | Default `mxn` |
| `PAYMENT_HOLD_MINUTES` | Payment window of a pending reservation, default `35` (minimum 31, Stripe sessions last at least 30 minutes) |
| `FRONTEND_URL` | Where Stripe redirects after checkout, default `http://localhost:5173` |

Never commit the secret key: `.env` is ignored by git.

Invoicing variables (the defaults use Profact's test environment, see [Invoices](#invoices-cfdi-40)):

| Variable | Description |
| -------- | ----------- |
| `INVOICE_DRIVER` | `profact` (default) or `fake` |
| `PROFACT_WSDL` | Default `https://pruebas.timbracfdi33.mx/Timbrado.asmx?wsdl`; production is `https://timbracfdi33.mx:1443/Timbrado.asmx?wsdl` |
| `PROFACT_USER` | Integrator user, default the test user `mvpNUXmQfK8=` |
| `PROFACT_VERIFY_SSL` | Verify Profact's TLS certificate, default `false` (the test server's certificate is not trusted) |
| `INVOICE_SERIES` | CFDI series, default `H`; the folio is the invoice id |
| `HOTEL_TIMEZONE` | Time zone for invoice dates and the admin summary ("today", "this month"), default `America/Mexico_City` |
| `INVOICE_EMITTER_RFC`, `INVOICE_EMITTER_NAME`, `INVOICE_EMITTER_TAX_REGIME`, `INVOICE_EMITTER_POSTAL_CODE` | The hotel's fiscal data, default the SAT test emitter `IIA040805DZ4` |

Invoicing needs the PHP **soap** extension: uncomment `extension=soap` in `php.ini` (in Laragon: *Menu → PHP → Extensions → soap*) and restart the server.

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
cd laravel-service && php artisan test   # requires a MySQL database named "testing" (see phpunit.xml); payments use the fake driver
cd nest-client && npm test
```

## Technologies

* PHP, Laravel, Laravel Sanctum
* Stripe Checkout (`stripe/stripe-php`)
* Profact PAC (SOAP) for CFDI 4.0 invoices
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
