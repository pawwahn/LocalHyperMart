-- Align stored platform settings and legal copy with KoyaKart branding.
UPDATE platform_settings
SET setting_value = replace(
        replace(
            replace(
                replace(setting_value::text, 'KoYaKart', 'KoyaKart'),
                'HyperLocalMart', 'KoyaKart'),
            'KOYAKART', 'KoyaKart'),
        'HYPERLOCALMART', 'KoyaKart')::jsonb,
    updated_at = NOW()
WHERE setting_value::text LIKE '%KoYaKart%'
   OR setting_value::text LIKE '%HyperLocalMart%'
   OR setting_value::text LIKE '%KOYAKART%'
   OR setting_value::text LIKE '%HYPERLOCALMART%';
