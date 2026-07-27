-- Hub/ops alerts when a vendor rejects a shop bag (CF4).
INSERT INTO notification_templates (event_code, channel, body_template, status) VALUES
    ('VENDOR_SHOP_REJECTED', 'SMS',
     'HyperLocalMart hub: {{shopName}} rejected bag on {{orderNumber}} (Rs {{amount}}). Reason: {{reason}}. Buyer: {{buyerPhone}}.',
     'ACTIVE'),
    ('VENDOR_SHOP_REJECTED', 'PUSH',
     '{{shopName}} rejected {{orderNumber}} (Rs {{amount}}). {{reason}}',
     'ACTIVE'),
    ('ITEM_REMOVED_COD_REDUCED', 'SMS',
     'HyperLocalMart: {{itemName}} removed from order {{orderNumber}}. New COD total Rs {{newTotal}}.',
     'ACTIVE'),
    ('ITEM_REMOVED_COD_REDUCED', 'PUSH',
     '{{itemName}} removed from {{orderNumber}}. COD now Rs {{newTotal}}.',
     'ACTIVE')
ON CONFLICT (event_code, channel, language) DO NOTHING;
