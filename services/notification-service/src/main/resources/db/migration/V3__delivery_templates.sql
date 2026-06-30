INSERT INTO notification_templates (event_code, channel, body_template, status) VALUES
    ('OUT_FOR_DELIVERY', 'SMS', 'HyperLocalMart: Order {{orderNumber}} is out for delivery. Share OTP {{otp}} with the agent.', 'ACTIVE'),
    ('ORDER_DELIVERED', 'SMS', 'HyperLocalMart: Order {{orderNumber}} has been delivered. Thank you!', 'ACTIVE');
