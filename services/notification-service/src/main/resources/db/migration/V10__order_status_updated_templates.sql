INSERT INTO notification_templates (event_code, channel, body_template, status) VALUES
    ('ORDER_STATUS_UPDATED', 'SMS',
     'KoyaKart: {{serviceName}} order {{orderNumber}} — {{statusLabel}}.',
     'ACTIVE'),
    ('ORDER_STATUS_UPDATED', 'PUSH',
     '{{serviceName}} · {{orderNumber}}: {{statusLabel}}',
     'ACTIVE')
ON CONFLICT (event_code, channel, language) DO NOTHING;
