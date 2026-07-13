-- Reset pilot transaction data (orders, deliveries, carts, payments, notifications).
-- Keeps seed data: users, towns, vendors, catalog, hubs, agents.

\c hyperlocalmart_delivery
TRUNCATE TABLE delivery_events, delivery_otps, delivery_assignments RESTART IDENTITY CASCADE;

\c hyperlocalmart_order
TRUNCATE TABLE order_items, order_status_history, vendor_sub_orders, orders,
    idempotency_records, outbox_events, processed_events, daily_order_sequences
    RESTART IDENTITY CASCADE;

\c hyperlocalmart_cart
TRUNCATE TABLE cart_items, carts RESTART IDENTITY CASCADE;

\c hyperlocalmart_payment
TRUNCATE TABLE payments, payment_webhook_logs RESTART IDENTITY CASCADE;

\c hyperlocalmart_notification
TRUNCATE TABLE notification_logs RESTART IDENTITY CASCADE;
