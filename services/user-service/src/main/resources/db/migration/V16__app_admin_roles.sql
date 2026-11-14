INSERT INTO roles (name, description) VALUES
    ('APP_ADMIN_WRITE', 'App admin — create and update towns, hubs, vendors, catalog'),
    ('APP_ADMIN_READ', 'App admin — read-only and bill generation; no money actions')
ON CONFLICT (name) DO NOTHING;
