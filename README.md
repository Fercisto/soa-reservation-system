# SOA Reservation System

A Service-Oriented Architecture (SOA) project developed as an academic project to demonstrate service interoperability and communication between applications built with different programming languages and technologies.

## Overview

The system follows a centralized service-oriented approach in which Laravel acts as the main backend service and contains the business logic of the reservation system.

Other applications developed with different technologies consume the functionality provided by Laravel through REST APIs.

The purpose of the project is to demonstrate how applications developed with different programming languages and frameworks can communicate with a central service through standardized interfaces.

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
                  │                │                │
                  ▼                ▼                ▼
           ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
           │   NestJS    │  │   Python    │  │    Java     │
           │    Client   │  │    Client   │  │    Client   │
           └─────────────┘  └─────────────┘  └─────────────┘
```

Laravel is responsible for the main business rules and data processing. The other applications consume Laravel's APIs to access these functionalities.

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

The service exposes RESTful endpoints that can be consumed by applications developed with different programming languages.

## Clients

### NestJS Client

A Node.js and NestJS application that consumes the Laravel REST API.

Its purpose is to demonstrate interoperability between:

* PHP / Laravel
* JavaScript / Node.js / NestJS

The NestJS application does not contain the main business logic. Instead, it requests the required functionality from the Laravel service.

### Python Client

A Python application that consumes the Laravel REST API.

Its purpose is to demonstrate communication between:

* PHP / Laravel
* Python

### Java Client

A Java application that consumes the Laravel REST API.

Its purpose is to demonstrate communication between:

* PHP / Laravel
* Java

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

This allows applications developed with different technologies to use the same authentication service.

## Technologies

The project may include:

* PHP
* Laravel
* Laravel Sanctum
* Node.js
* NestJS
* Python
* Java
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
├── python-client/
│   └── Python application
│
├── java-client/
│   └── Java application
│
├── soa-frontend/
│   └── React application
│
├── .gitignore
└── README.md
```

## Academic Project

This project was developed as part of a Service-Oriented Architecture (SOA) course.

The main objective is to demonstrate service interoperability by allowing applications developed with different programming languages and technologies to consume the functionality provided by a central Laravel service.
