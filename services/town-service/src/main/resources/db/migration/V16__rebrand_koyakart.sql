UPDATE platform_settings
SET setting_value = replace(
        replace(setting_value::text, 'HYPERLOCALMART', 'KOYAKART'),
        'HyperLocalMart',
        'KoYaKart'
    )::jsonb,
    updated_at = NOW()
WHERE setting_value::text LIKE '%HyperLocalMart%'
   OR setting_value::text LIKE '%HYPERLOCALMART%';
