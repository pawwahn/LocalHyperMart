INSERT INTO notification_templates (event_code, channel, language, body_template, status)
VALUES (
    'ITEM_CANCELLED_STORE_CREDIT',
    'SMS',
    'en',
    'HyperLocalMart: {{itemName}} removed from order {{orderNumber}}. Rs {{amount}} credited for next order. Balance Rs {{balance}}.',
    'ACTIVE'
)
ON CONFLICT (event_code, channel, language) DO NOTHING;
