# HyperLocalMart Event Driven Architecture

## Version

1.0

---

# Purpose

This document defines Kafka architecture, producer-consumer contracts, retry mechanisms, dead-letter queues, idempotency, event schemas, observability, and event processing standards.

All services must follow this specification.

---

# Architecture Principles

1. Every service owns its database.
2. Services never access another service database.
3. REST is used for queries.
4. Kafka is used for business events.
5. Events are immutable.
6. Consumers must be idempotent.
7. Correlation IDs must be propagated across all services.

---

# Kafka Topic Naming Convention

Format:

hyperlocalmart.<domain>.<event>

Examples:

hyperlocalmart.order.created

hyperlocalmart.order.cancelled

hyperlocalmart.payment.success

hyperlocalmart.payment.failed

hyperlocalmart.delivery.assigned

hyperlocalmart.delivery.completed

hyperlocalmart.notification.requested

---

# Topic Ownership

## Order Service

Produces:

* hyperlocalmart.order.created
* hyperlocalmart.order.cancelled

Consumes:

* payment.success
* payment.failed

---

## Payment Service

Produces:

* hyperlocalmart.payment.success
* hyperlocalmart.payment.failed

Consumes:

* order.created

---

## Delivery Service

Produces:

* hyperlocalmart.delivery.assigned
* hyperlocalmart.delivery.completed

Consumes:

* payment.success

---

## Notification Service

Consumes:

* order.created
* payment.success
* payment.failed
* delivery.assigned
* delivery.completed

---

## Analytics Service

Consumes all business events.

---

# Consumer Groups

payment-service-group

delivery-service-group

notification-service-group

analytics-service-group

---

# Standard Event Envelope

Every event must follow the same structure.

{
"eventId":"uuid",
"correlationId":"uuid",
"eventType":"string",
"sourceService":"string",
"version":"v1",
"timestamp":"ISO-8601",
"payload":{}
}

---

# ORDER_CREATED Event

Producer:

Order Service

Consumers:

Payment Service

Notification Service

Analytics Service

Payload:

{
"orderId":"uuid",
"customerId":"uuid",
"totalAmount":2500,
"vendorCount":3,
"vendorOrderIds":[]
}

---

# PAYMENT_SUCCESS Event

Producer:

Payment Service

Consumers:

Delivery Service

Notification Service

Analytics Service

Payload:

{
"paymentId":"uuid",
"orderId":"uuid",
"amount":2500,
"paymentMethod":"UPI"
}

---

# PAYMENT_FAILED Event

Producer:

Payment Service

Consumers:

Notification Service

Analytics Service

Payload:

{
"paymentId":"uuid",
"orderId":"uuid",
"failureReason":"FAILED"
}

---

# DELIVERY_ASSIGNED Event

Producer:

Delivery Service

Consumers:

Notification Service

Analytics Service

Payload:

{
"deliveryId":"uuid",
"partnerId":"uuid",
"orderId":"uuid"
}

---

# DELIVERY_COMPLETED Event

Producer:

Delivery Service

Consumers:

Notification Service

Analytics Service

Payload:

{
"deliveryId":"uuid",
"orderId":"uuid",
"completedAt":"timestamp"
}

---

# Outbox Pattern

Mandatory.

Every producer service must implement Transactional Outbox Pattern.

Purpose:

Avoid database transaction success and Kafka publish failure inconsistency.

---

# Outbox Table

outbox_events

Columns:

id

event_id

aggregate_id

aggregate_type

event_type

payload

status

created_at

published_at

---

# Outbox Workflow

Step 1

Business transaction commits.

Step 2

Event stored in outbox table.

Step 3

Outbox scheduler executes.

Step 4

Kafka publish occurs.

Step 5

Status marked PUBLISHED.

---

# Idempotency

Consumers must process events exactly once.

Table:

processed_events

Columns:

event_id

processed_at

Workflow:

1. Receive event.
2. Check processed_events.
3. If already processed → ignore.
4. Else process.
5. Save processed event.

---

# Retry Strategy

Transient failures:

Retry 3 times.

Backoff:

2 seconds

5 seconds

10 seconds

After retry exhaustion:

Publish to Dead Letter Queue.

---

# Dead Letter Queue Topics

hyperlocalmart.order.dlq

hyperlocalmart.payment.dlq

hyperlocalmart.delivery.dlq

hyperlocalmart.notification.dlq

---

# Ordering Guarantees

Kafka key:

orderId

All events for a single order must remain in order.

Example:

ORDER_CREATED

PAYMENT_SUCCESS

DELIVERY_ASSIGNED

DELIVERY_COMPLETED

---

# Partition Strategy

Development:

Partitions = 3

Replication Factor = 1

Production:

Partitions = 6+

Replication Factor = 3

---

# Observability

Every log entry must include:

timestamp

serviceName

correlationId

eventId

eventType

status

Structured JSON logging preferred.

---

# Metrics

Expose Prometheus metrics.

Required metrics:

events_produced_total

events_consumed_total

events_failed_total

dlq_messages_total

consumer_lag

---

# Spring Boot Standards

Java 21

Spring Boot 3

Spring Kafka

Flyway

MapStruct

Lombok

OpenAPI

Actuator

Micrometer

Prometheus

---

# Package Structure

com.hyperlocalmart

config

controller

service

repository

entity

dto

mapper

producer

consumer

event

scheduler

exception

security

util

---

# Kafka Producer Standards

Use KafkaTemplate.

Publish asynchronously.

Include correlationId.

Log success.

Log failure.

---

# Kafka Consumer Standards

Use @KafkaListener.

Manual acknowledgement.

Idempotent processing.

Centralized exception handling.

DLQ support.

---

# Security Standards

JWT Authentication.

BCrypt Password Encoding.

Role Based Access Control.

Audit Logging.

Correlation ID propagation.

---

# Docker Services

Infrastructure:

* zookeeper
* kafka
* kafka-ui
* redis

Databases:

* postgres-user
* postgres-vendor
* postgres-catalog
* postgres-order
* postgres-payment
* postgres-delivery

Applications:

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

---

# Cursor Generation Requirements

Generate:

1. Kafka Producer Framework
2. Kafka Consumer Framework
3. Generic Event Model
4. Transactional Outbox Pattern
5. DLQ Handling
6. Retry Mechanism
7. Idempotency Framework
8. Correlation ID Middleware
9. Kafka Configuration
10. Integration Tests
11. Docker Compose
12. OpenAPI Documentation
13. Health Checks
14. Prometheus Metrics
15. Structured Logging

Code must be production-ready and follow clean architecture principles.
