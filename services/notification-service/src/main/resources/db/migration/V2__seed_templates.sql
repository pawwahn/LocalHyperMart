INSERT INTO notification_templates (event_code, channel, body_template, status) VALUES
    ('ORDER_PLACED', 'SMS', 'HyperLocalMart: Order {{orderNumber}} placed. Total Rs {{totalAmount}}.', 'ACTIVE'),
    ('ORDER_CANCELLED', 'SMS', 'HyperLocalMart: Order {{orderNumber}} cancelled. Reason: {{reason}}', 'ACTIVE'),
    ('REFUND_INITIATED', 'SMS', 'HyperLocalMart: Refund of Rs {{amount}} initiated for order {{orderNumber}}. Expected in {{workingDays}} working days.', 'ACTIVE'),
    ('SUB_ORDER_READY', 'SMS', 'HyperLocalMart: Items from {{shopName}} are ready for pickup (order {{orderNumber}}).', 'ACTIVE');
