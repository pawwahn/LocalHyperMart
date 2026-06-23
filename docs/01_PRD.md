# HyperLocalMart - Product Requirements Document (PRD)

## Version

1.0

## Product Name

HyperLocalMart

## Vision

Build a hyperlocal marketplace platform for Tier-2 and Tier-3 Indian towns where customers can purchase products from multiple local vendors in a single order.

Example:

Customer orders:

* Rice from Grocery Store A
* Tomatoes from Vegetable Store B
* Shampoo from Fancy Store C

System automatically splits the order into vendor-specific orders while presenting a single order experience to the customer.

---

# Business Model

## Customers

Mobile/Web Application

## Vendors

Monthly Subscription

* ₹5,000/month introductory
* ₹10,000/month regular
* ₹50,000/year discounted

## Delivery Partners

Local delivery personnel managed by platform.

---

# Roles

## Customer

Can:

* Register/Login
* Browse Products
* Search Products
* Add to Cart
* Place Order
* Track Order
* View Order History
* Manage Address

## Vendor

Can:

* Register
* Manage Shop
* Manage Products
* Manage Inventory
* Accept Orders
* Reject Orders
* Update Order Status
* View Revenue

## Delivery Partner

Can:

* View Assigned Deliveries
* Accept Delivery
* Mark Picked Up
* Mark Delivered

## Admin

Can:

* Manage Vendors
* Manage Customers
* Manage Delivery Partners
* Manage Categories
* View Analytics
* Handle Disputes

---

# Microservice Architecture

## API Gateway

Responsibilities:

* Authentication
* Routing
* Rate Limiting
* Request Logging

Technology:

* Spring Cloud Gateway

---

## User Service

Responsibilities:

* Registration
* Login
* JWT Authentication
* Role Management

Database:

PostgreSQL

---

## Vendor Service

Responsibilities:

* Vendor Registration
* Shop Management
* Vendor Verification

---

## Catalog Service

Responsibilities:

* Categories
* Products
* Inventory

---

## Cart Service

Responsibilities:

* Shopping Cart
* Cart Items

---

## Order Service

Responsibilities:

* Order Placement
* Multi Vendor Order Split
* Order Tracking

---

## Payment Service

Responsibilities:

* Payment Processing
* Refunds

---

## Delivery Service

Responsibilities:

* Delivery Assignment
* Tracking

---

## Notification Service

Responsibilities:

* Email Notifications
* SMS Notifications
* Push Notifications

---

# Technology Stack

Backend

* Java 21
* Spring Boot 3
* Spring Security
* Spring Cloud
* JPA
* Hibernate
* Maven

Frontend

* React
* TypeScript
* Redux Toolkit
* Material UI

Database

* PostgreSQL

Messaging

* Apache Kafka

Caching

* Redis

Authentication

* JWT

Containerization

* Docker

Orchestration

* Docker Compose

---

# Database Design

Core Tables

* users
* vendors
* shops
* categories
* products
* inventory
* carts
* cart_items
* orders
* vendor_orders
* order_items
* payments
* delivery_partners
* deliveries

---

# Order Flow

Step 1

Customer adds products from multiple vendors.

Step 2

Customer places order.

Step 3

System creates Master Order.

Step 4

System creates Vendor Orders.

Example:

MASTER_ORDER_1001

ORDER_1001_A

ORDER_1001_B

ORDER_1001_C

Step 5

Payment completed.

Step 6

Vendor receives order.

Step 7

Delivery partner assigned.

Step 8

Customer receives updates.

Step 9

Delivery completed.

---

# APIs

## User APIs

POST /api/users/register

POST /api/users/login

GET /api/users/profile

PUT /api/users/profile

---

## Vendor APIs

POST /api/vendors/register

GET /api/vendors

GET /api/vendors/{id}

PUT /api/vendors/{id}

DELETE /api/vendors/{id}

---

## Product APIs

POST /api/products

GET /api/products

GET /api/products/{id}

PUT /api/products/{id}

DELETE /api/products/{id}

---

## Cart APIs

POST /api/cart/add

POST /api/cart/remove

GET /api/cart

---

## Order APIs

POST /api/orders

GET /api/orders

GET /api/orders/{id}

---

## Payment APIs

POST /api/payments

GET /api/payments/{id}

---

# Non Functional Requirements

Availability

99.9%

Response Time

Less than 500 ms

Security

* JWT Authentication
* Password Encryption
* Role Based Access Control
* Audit Logs

Scalability

* 10,000 Concurrent Users
* 5,000 Orders Per Day

---

# MVP Scope

Phase 1

* Customer Registration
* Vendor Registration
* Product Catalog
* Cart
* Multi Vendor Order Split
* Order Tracking

Phase 2

* Payments
* Delivery Partner App
* Notifications

Phase 3

* AI Recommendations
* Demand Forecasting
* Analytics Dashboard

---

# Deliverables Expected From Cursor

Generate:

1. Complete Microservice Architecture
2. Spring Boot Applications
3. PostgreSQL Schemas
4. Flyway Migrations
5. Docker Compose
6. Kafka Configuration
7. Redis Configuration
8. REST APIs
9. JWT Security
10. Unit Tests
11. Integration Tests
12. Swagger Documentation
13. Postman Collection
14. CI/CD Pipeline
15. Kubernetes Deployment Files

Code must be production-ready, scalable, and follow clean architecture principles.
