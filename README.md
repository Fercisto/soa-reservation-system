# SOA Reservation System

A Service-Oriented Architecture (SOA) project developed as an academic project to demonstrate communication between React, NestJS, and Laravel services.

## Overview

The system follows a service-oriented architecture where the React frontend communicates with a NestJS service through REST APIs.

NestJS acts as an intermediary service between the frontend and the Laravel service. It receives requests from the frontend and communicates with Laravel to perform the required operations.

Laravel contains the main business logic, authentication, database operations, and reservation management.

The purpose of the project is to demonstrate interoperability between different technologies through REST APIs.

## Architecture

The system follows this communication flow:

```text
┌───────────────────┐
│   React Frontend  │
│   soa-frontend    │
└─────────┬─────────┘
          │
          │ REST API
          ▼
┌───────────────────┐
│      NestJS       │
│   Node.js / Nest  │
│                   │
│  API / Gateway    │
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
          ▼
┌───────────────────┐
│      Database     │
└───────────────────┘
```

The React frontend communicates only with NestJS. NestJS communicates with Laravel, which handles the main business rules and database operations.

## Services

### Laravel Service

Laravel acts as the main backend service and contains the core business logic of the reservation system.

Responsibilities include:

* User authentication
* User management
* Room management
* Reservation management
* Payment processing
* Notification management
* Business rules
* Database operations
* REST API endpoints

Laravel exposes RESTful endpoints that are consumed by the NestJS service.

### NestJS Service

NestJS acts as an intermediary service between the React frontend and Laravel.

Responsibilities include:

* Exposing REST endpoints for the frontend
* Receiving requests from React
* Communicating with the Laravel service
* Forwarding data between services
* Handling communication errors
* Passing authentication tokens to Laravel

NestJS does not contain the main business rules. Instead, it delegates the main operations to the Laravel service.

### React Frontend

The frontend application is developed with React.

Responsibilities include:

* User interface
* Login and registration forms
* Room visualization
* Reservation creation
* Reservation cancellation
* Displaying reservation history
* Communicating with the NestJS service

The frontend does not communicate directly with Laravel.

## Communication

The services communicate through RESTful APIs using HTTP and JSON.

The general request flow is:

```text
React Frontend
      │
      │ HTTP Request
      ▼
    NestJS
      │
      │ HTTP Request
      ▼
   Laravel
      │
      │ Business Logic
      ▼
   Database
      │
      │ Data
      ▼
   Laravel
      │
      │ JSON Response
      ▼
    NestJS
      │
      │ JSON Response
      ▼
React Frontend
```

For example, when a user creates a reservation:

```text
React
  │
  │ POST /reservations
  ▼
NestJS
  │
  │ POST /reservations
  ▼
Laravel
  │
  │ Validate reservation
  │ Apply business rules
  │ Save reservation
  ▼
Database
  │
  ▼
Laravel
  │
  │ JSON Response
  ▼
NestJS
  │
  ▼
React
```

## Authentication

Authentication is handled by the Laravel service using Laravel Sanctum.

The authentication flow is:

```text
React
  │
  │ Login
  ▼
NestJS
  │
  │ Login Request
  ▼
Laravel
  │
  │ Validate credentials
  │
  │ Access Token
  ▼
NestJS
  │
  │ Token
  ▼
React
```

For protected requests, the access token is sent using the `Authorization` header:

```text
Authorization: Bearer <token>
```

NestJS forwards the authentication token when communicating with Laravel.

This allows the frontend and NestJS service to use the authentication mechanism provided by the Laravel service.

## Technologies

The project uses:

* PHP
* Laravel
* Laravel Sanctum
* Node.js
* NestJS
* React
* REST APIs
* HTTP
* JSON
* MySQL

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

The main objective is to demonstrate interoperability between different technologies by implementing communication between React, NestJS, and Laravel through REST APIs.

The architecture demonstrates how different services can communicate independently while Laravel maintains the main business logic and data management.