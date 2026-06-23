# HyperLocalMart Database Schema & ERD

## Version

1.0

---

# Database Design Principles

1. Each microservice owns its database.
2. UUID must be used as primary key.
3. All tables must include audit fields.
4. Foreign keys only within the same service database.
5. Soft delete supported where applicable.

Standard Audit Fields:

created_at

updated_at

created_by

updated_by

---

# User Service Database

## users

id UUID PRIMARY KEY

first_name VARCHAR(100) NOT NULL

last_name VARCHAR(100)

email VARCHAR(255) UNIQUE NOT NULL

phone VARCHAR(20) UNIQUE NOT NULL

password_hash VARCHAR(255) NOT NULL

status VARCHAR(30) NOT NULL

created_at TIMESTAMP

updated_at TIMESTAMP

Indexes

email

phone

---

## roles

id UUID PRIMARY KEY

name VARCHAR(50) UNIQUE NOT NULL

description VARCHAR(255)

created_at TIMESTAMP

updated_at TIMESTAMP

---

## user_roles

id UUID PRIMARY KEY

user_id UUID NOT NULL

role_id UUID NOT NULL

created_at TIMESTAMP

Unique Constraint

(user_id, role_id)

---

# Vendor Service Database

## vendors

id UUID PRIMARY KEY

business_name VARCHAR(255)

owner_name VARCHAR(255)

email VARCHAR(255)

phone VARCHAR(20)

gst_number VARCHAR(50)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Indexes

phone

email

gst_number

---

## shops

id UUID PRIMARY KEY

vendor_id UUID NOT NULL

shop_name VARCHAR(255)

address TEXT

city VARCHAR(100)

state VARCHAR(100)

pincode VARCHAR(20)

latitude DECIMAL(10,8)

longitude DECIMAL(11,8)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

vendor_id

---

# Catalog Service Database

## categories

id UUID PRIMARY KEY

name VARCHAR(100)

description TEXT

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

---

## products

id UUID PRIMARY KEY

vendor_id UUID NOT NULL

category_id UUID NOT NULL

name VARCHAR(255)

description TEXT

price DECIMAL(12,2)

mrp DECIMAL(12,2)

image_url TEXT

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Indexes

vendor_id

category_id

name

---

## inventory

id UUID PRIMARY KEY

product_id UUID NOT NULL

quantity INTEGER

reserved_quantity INTEGER

updated_at TIMESTAMP

Unique Constraint

product_id

---

# Cart Service Database

## carts

id UUID PRIMARY KEY

user_id UUID NOT NULL

created_at TIMESTAMP

updated_at TIMESTAMP

---

## cart_items

id UUID PRIMARY KEY

cart_id UUID NOT NULL

product_id UUID NOT NULL

quantity INTEGER

price DECIMAL(12,2)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

cart_id

---

# Order Service Database

## orders

id UUID PRIMARY KEY

user_id UUID NOT NULL

total_amount DECIMAL(12,2)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

user_id

---

## vendor_orders

id UUID PRIMARY KEY

order_id UUID NOT NULL

vendor_id UUID NOT NULL

amount DECIMAL(12,2)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Indexes

order_id

vendor_id

---

## order_items

id UUID PRIMARY KEY

vendor_order_id UUID NOT NULL

product_id UUID NOT NULL

quantity INTEGER

price DECIMAL(12,2)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

vendor_order_id

---

## outbox_events

id UUID PRIMARY KEY

event_id UUID

aggregate_id UUID

aggregate_type VARCHAR(100)

event_type VARCHAR(100)

payload JSONB

status VARCHAR(30)

created_at TIMESTAMP

published_at TIMESTAMP

---

## processed_events

id UUID PRIMARY KEY

event_id UUID UNIQUE

processed_at TIMESTAMP

---

# Payment Service Database

## payments

id UUID PRIMARY KEY

order_id UUID NOT NULL

amount DECIMAL(12,2)

status VARCHAR(30)

transaction_reference VARCHAR(255)

payment_method VARCHAR(50)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

order_id

---

## refunds

id UUID PRIMARY KEY

payment_id UUID NOT NULL

amount DECIMAL(12,2)

reason VARCHAR(255)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

payment_id

---

# Delivery Service Database

## delivery_partners

id UUID PRIMARY KEY

name VARCHAR(255)

phone VARCHAR(20)

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

Index

phone

---

## deliveries

id UUID PRIMARY KEY

vendor_order_id UUID NOT NULL

partner_id UUID NOT NULL

status VARCHAR(30)

assigned_at TIMESTAMP

picked_up_at TIMESTAMP

delivered_at TIMESTAMP

created_at TIMESTAMP

updated_at TIMESTAMP

Indexes

vendor_order_id

partner_id

---

# Notification Service Database

## notification_logs

id UUID PRIMARY KEY

recipient VARCHAR(255)

channel VARCHAR(50)

message TEXT

status VARCHAR(30)

created_at TIMESTAMP

updated_at TIMESTAMP

---

# ERD Relationships

users

1 -> many carts

users

1 -> many orders

vendors

1 -> many shops

vendors

1 -> many products

categories

1 -> many products

products

1 -> 1 inventory

orders

1 -> many vendor_orders

vendor_orders

1 -> many order_items

payments

1 -> many refunds

delivery_partners

1 -> many deliveries

---

# Cursor Generation Requirements

Generate:

1. Flyway Migrations
2. JPA Entities
3. Repositories
4. DTOs
5. Database Constraints
6. Indexes
7. Liquibase compatibility
8. Audit Field Support
9. UUID Primary Keys
10. PostgreSQL Optimized Queries

All schema definitions must be production ready.
