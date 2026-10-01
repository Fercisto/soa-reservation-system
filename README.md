# SOA Reservation System

A Service-Oriented Architecture (SOA) project developed as an academic project to demonstrate communication between a central Laravel service and a NestJS client.

## Overview

The system follows a centralized service-oriented approach in which Laravel acts as the main backend service and contains the business logic of the reservation system.

The NestJS client consumes the functionality provided by Laravel through REST APIs.

The purpose of the project is to demonstrate how Laravel and NestJS communicate through standardized REST interfaces.

## Architecture

The project follows a service-oriented architecture where Laravel acts as the main service provider.

```text
                         ┌───────────────────┐
                         │    React Frontend │
                         │   soa-frontend    │
                         └─────────┬─────────┘
                                   │
                                   │ REST API
                                   ▼
                         ┌───────────────────┐
                         │  Laravel Service  │
                         │   PHP / Laravel   │
                         │                   │
                         │  Business Logic   │
                         │  Authentication   │
                         │  Reservations     │
                         │  Rooms            │
                         │  Payments         │
                         │  Notifications    │
                         └─────────┬─────────┘
                                   │
                  ┌────────────────┼────────────────┐
                                    │
                                    ▼
                            ┌───────────────────┐
                            │   NestJS Client   │
                            │   Node.js / Nest  │
                            └───────────────────┘
```

      Laravel is responsible for the main business rules and data processing. NestJS consumes Laravel's APIs to access these functionalities.

## Main Service

### Laravel Service

The Laravel application is the central service of the system.

Responsibilities include:

* User authentication
* User management
* Room management
* Reservation management
* Payment processing
* Notification management
* Business rules
* Database operations
* API endpoints

The service exposes RESTful endpoints consumed by the NestJS client and the React frontend.

## Clients

### NestJS Client

A Node.js and NestJS application that consumes the Laravel REST API.

Its purpose is to demonstrate interoperability between:

* PHP / Laravel
* JavaScript / Node.js / NestJS

The NestJS application does not contain the main business logic. Instead, it requests the required functionality from the Laravel service.

## Frontend

### SOA Frontend

The frontend application is developed with React and consumes the REST API provided by Laravel.

The frontend is responsible for the user interface and interaction with the system, while the business logic remains in the Laravel service.

## Communication

The applications communicate through RESTful APIs using HTTP and JSON.

Example:

```text
NestJS Client
      │
      │ HTTP Request
      │
      ▼
Laravel REST API
      │
      │ Business Logic
      ▼
Database
      │
      │
      ▼
Laravel REST API
      │
      │ JSON Response
      ▼
NestJS Client
```

## Authentication

Authentication is handled by the Laravel service using Laravel Sanctum.

Clients authenticate through Laravel and receive an access token. The token is then sent in the `Authorization` header when accessing protected endpoints.

```text
Client
  │
  │ Login
  ▼
Laravel
  │
  │ Access Token
  ▼
Client
  │
  │ Authorization: Bearer <token>
  ▼
Laravel API
```

This allows the NestJS client and the frontend to use the same authentication service.

## Technologies

The project uses:

* PHP
* Laravel
* Laravel Sanctum
* Node.js
* NestJS
* React
* REST APIs
* JSON
* MySQL / PostgreSQL

## Project Structure

```text
soa/
│
├── laravel-service/
│   └── Laravel application
│
├── nest-client/
│   └── NestJS application
│
├── soa-frontend/
│   └── React application
│
├── .gitignore
└── README.md
```

## Academic Project

This project was developed as part of a Service-Oriented Architecture (SOA) course.

The main objective is to demonstrate service interoperability between a central Laravel service and a NestJS client through REST APIs.
