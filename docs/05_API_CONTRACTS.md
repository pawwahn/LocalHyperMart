# HyperLocalMart API Contracts

## Version

1.0

---

# API Standards

Base URL

/api/v1

Content Type

application/json

Authentication

JWT Bearer Token

All APIs must return:

success

message

data

timestamp

correlationId

---

# Standard Success Response

{
"success": true,
"message": "Operation successful",
"data": {},
"timestamp": "2026-06-24T10:00:00Z",
"correlationId": "uuid"
}

---

# Standard Error Response

{
"success": false,
"message": "Validation failed",
"errorCode": "VALIDATION_ERROR",
"timestamp": "2026-06-24T10:00:00Z",
"correlationId": "uuid"
}

---

# User APIs

## Register User

POST

/api/v1/users/register

Request

{
"firstName": "Pavan",
"lastName": "Kumar",
"email": "[user@example.com](mailto:user@example.com)",
"phone": "9999999999",
"password": "Password@123"
}

Validation

firstName required

email valid

phone valid

password minimum 8 characters

Response

201 Created

{
"userId": "uuid"
}

---

## Login

POST

/api/v1/users/login

Request

{
"email": "[user@example.com](mailto:user@example.com)",
"password": "Password@123"
}

Response

{
"accessToken": "jwt",
"refreshToken": "jwt"
}

---

## Get Profile

GET

/api/v1/users/profile

Response

{
"id": "uuid",
"firstName": "Pavan",
"lastName": "Kumar",
"email": "[user@example.com](mailto:user@example.com)"
}

---

# Vendor APIs

## Create Vendor

POST

/api/v1/vendors

Request

{
"businessName": "ABC Stores",
"ownerName": "Ravi",
"email": "[vendor@example.com](mailto:vendor@example.com)",
"phone": "9999999999",
"gstNumber": "GST123"
}

Response

201 Created

{
"vendorId": "uuid"
}

---

## Get Vendor

GET

/api/v1/vendors/{id}

Response

{
"vendorId": "uuid",
"businessName": "ABC Stores"
}

---

# Product APIs

## Create Product

POST

/api/v1/products

Request

{
"vendorId": "uuid",
"categoryId": "uuid",
"name": "Tomato",
"description": "Fresh tomato",
"price": 30,
"mrp": 35
}

Response

201 Created

{
"productId": "uuid"
}

---

## Get Product

GET

/api/v1/products/{id}

Response

{
"id": "uuid",
"name": "Tomato",
"price": 30
}

---

## Search Products

GET

/api/v1/products?keyword=tomato

Response

{
"items": []
}

---

# Cart APIs

## Add To Cart

POST

/api/v1/cart/items

Request

{
"productId": "uuid",
"quantity": 2
}

Response

{
"cartId": "uuid"
}

---

## Get Cart

GET

/api/v1/cart

Response

{
"cartId": "uuid",
"items": []
}

---

## Remove Cart Item

DELETE

/api/v1/cart/items/{itemId}

Response

204 No Content

---

# Order APIs

## Create Order

POST

/api/v1/orders

Request

{
"cartId": "uuid",
"addressId": "uuid"
}

Response

{
"orderId": "uuid",
"status": "CREATED"
}

---

## Get Order

GET

/api/v1/orders/{id}

Response

{
"orderId": "uuid",
"status": "PAID"
}

---

## Get User Orders

GET

/api/v1/orders

Response

{
"items": []
}

---

# Payment APIs

## Initiate Payment

POST

/api/v1/payments

Request

{
"orderId": "uuid",
"amount": 500
}

Response

{
"paymentId": "uuid",
"status": "PENDING"
}

---

## Get Payment

GET

/api/v1/payments/{id}

Response

{
"paymentId": "uuid",
"status": "SUCCESS"
}

---

# Delivery APIs

## Assign Delivery

POST

/api/v1/deliveries/assign

Request

{
"vendorOrderId": "uuid"
}

Response

{
"deliveryId": "uuid"
}

---

## Track Delivery

GET

/api/v1/deliveries/{id}

Response

{
"deliveryId": "uuid",
"status": "OUT_FOR_DELIVERY"
}

---

# HTTP Status Codes

200 OK

201 CREATED

204 NO CONTENT

400 BAD REQUEST

401 UNAUTHORIZED

403 FORBIDDEN

404 NOT FOUND

409 CONFLICT

500 INTERNAL SERVER ERROR

---

# Validation Standards

Bean Validation

@NotNull

@NotBlank

@Email

@Pattern

@Size

@Min

@Max

---

# OpenAPI Standards

Every endpoint must include:

Summary

Description

Request Example

Response Example

Error Responses

---

# Cursor Generation Requirements

Generate:

1. Controllers
2. DTOs
3. Request Models
4. Response Models
5. Validation Rules
6. Exception Handling
7. OpenAPI Documentation
8. Integration Tests
9. Global Error Handler
10. Correlation ID Support

All APIs must follow REST best practices and be production-ready.
