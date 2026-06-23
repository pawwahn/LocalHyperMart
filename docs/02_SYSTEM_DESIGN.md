# HyperLocalMart System Design & Sequence Specification

## Version

1.0

---

# System Architecture

Customer App

↓

API Gateway

↓

Services

* User Service
* Vendor Service
* Catalog Service
* Cart Service
* Order Service
* Payment Service
* Delivery Service
* Notification Service
* Analytics Service

Kafka is used for asynchronous business events.

PostgreSQL is used as the primary database.

Redis is used for caching.

---

# Service Ownership

## User Service

Owns:

* Users
* Roles
* Authentication
* JWT

## Vendor Service

Owns:

* Vendors
* Shops

## Catalog Service

Owns:

* Products
* Categories
* Inventory

## Cart Service

Owns:

* Cart
* Cart Items

## Order Service

Owns:

* Orders
* Vendor Orders
* Order Items

## Payment Service

Owns:

* Payments
* Refunds

## Delivery Service

Owns:

* Delivery Partners
* Deliveries

## Notification Service

Owns:

* Email Notifications
* SMS Notifications
* Push Notifications

## Analytics Service

Owns:

* Reports
* Dashboards
* KPIs

---

# Database Per Service Pattern

Every service owns its own database.

No service may directly access another service database.

Examples:

User Database

* users
* roles

Vendor Database

* vendors
* shops

Catalog Database

* products
* categories
* inventory

Order Database

* orders
* vendor_orders
* order_items

Payment Database

* payments
* refunds

Delivery Database

* deliveries
* delivery_partners

---

# Communication Pattern

## REST APIs

Used for:

* Login
* Registration
* Product Search
* Product Details
* Cart Operations
* Vendor Management

## Kafka Events

Used for:

* Order Created
* Order Cancelled
* Payment Success
* Payment Failed
* Delivery Assigned
* Delivery Completed
* Notification Requests

---

# Kafka Topics

hyperlocalmart.order.created

hyperlocalmart.order.cancelled

hyperlocalmart.payment.success

hyperlocalmart.payment.failed

hyperlocalmart.delivery.assigned

hyperlocalmart.delivery.completed

hyperlocalmart.notification.requested

---

# Event Structure

Every event must contain:

* eventId
* correlationId
* eventType
* sourceService
* timestamp
* version
* payload

---

# Customer Registration Flow

Step 1

Customer submits registration request.

Step 2

API Gateway forwards request.

Step 3

User Service validates data.

Step 4

User stored in database.

Step 5

JWT token generated.

Step 6

Response returned.

---

# Product Search Flow

Step 1

Customer searches product.

Step 2

API Gateway forwards request.

Step 3

Catalog Service searches products.

Step 4

Response returned.

---

# Add To Cart Flow

Step 1

Customer selects product.

Step 2

Cart Service validates product.

Step 3

Cart item stored.

Step 4

Updated cart returned.

---

# Multi Vendor Order Flow

Customer places order.

Example:

Rice from Vendor A

Tomatoes from Vendor B

Soap from Vendor C

Order Service:

Creates:

MASTER_ORDER_1001

Creates:

ORDER_1001_A

ORDER_1001_B

ORDER_1001_C

Publishes:

hyperlocalmart.order.created

---

# Payment Flow

Order Service publishes:

hyperlocalmart.order.created

Payment Service consumes event.

Payment record created.

Customer pays.

Payment Service publishes:

hyperlocalmart.payment.success

or

hyperlocalmart.payment.failed

---

# Inventory Flow

Payment success triggers inventory update.

Catalog Service reduces stock.

Inventory cannot become negative.

Inventory updates are logged.

---

# Notification Flow

Notification Service consumes:

* order.created
* payment.success
* delivery.assigned
* delivery.completed

Notification channels:

* SMS
* Email
* Push Notification

---

# Delivery Flow

Delivery Service consumes:

payment.success

Creates delivery assignment.

Assigns delivery partner.

Publishes:

delivery.assigned

Upon successful delivery:

Publishes:

delivery.completed

---

# Order Status State Machine

CREATED

↓

PAYMENT_PENDING

↓

PAID

↓

VENDOR_ACCEPTED

↓

PACKED

↓

OUT_FOR_DELIVERY

↓

DELIVERED

Failure States:

* PAYMENT_FAILED
* CANCELLED
* REFUNDED
* RETURNED

---

# Security Design

JWT Authentication

BCrypt Password Encryption

Role Based Access Control

Roles:

* CUSTOMER
* VENDOR
* DELIVERY_PARTNER
* ADMIN

HTTPS Only

Request Validation

Audit Logging

---

# Logging Strategy

Every request must include:

* Correlation ID
* Request ID
* Timestamp

Logs must contain:

* Service Name
* Correlation ID
* Event Type
* Duration
* Status

Structured JSON logging preferred.

---

# Monitoring

Expose:

* /actuator/health
* /actuator/prometheus

Track:

* Orders Per Minute
* Active Users
* Failed Payments
* Delivery Time
* Vendor Acceptance Time

---

# Docker Architecture

Services:

* api-gateway
* user-service
* vendor-service
* catalog-service
* cart-service
* order-service
* payment-service
* delivery-service
* notification-service
* analytics-service

Infrastructure:

* kafka
* zookeeper
* redis
* postgres-user
* postgres-vendor
* postgres-catalog
* postgres-order
* postgres-payment
* postgres-delivery

---

# Future Enhancements

* AI Recommendations
* Demand Forecasting
* Loyalty Program
* Route Optimization
* WhatsApp Ordering
* Regional Language Support
* ONDC Integration
* Vendor Analytics Dashboard

This document defines how all services interact and how business flows operate within HyperLocalMart.
