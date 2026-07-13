-- Cart coupons (pilot): applied promo lives on the cart; codes owned by cart-service for MVP.
ALTER TABLE carts
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(40),
    ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS promo_codes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code             VARCHAR(40) NOT NULL UNIQUE,
    description      VARCHAR(255) NOT NULL,
    discount_type    VARCHAR(20) NOT NULL,
    discount_value   DECIMAL(12,2) NOT NULL,
    min_order_value  DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_discount     DECIMAL(12,2),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    usage_limit      INT,
    used_count       INT NOT NULL DEFAULT 0,
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    updated_by       UUID
);

INSERT INTO promo_codes (id, code, description, discount_type, discount_value, min_order_value, max_discount, active, usage_limit, used_count)
VALUES
    ('f1111111-1111-4111-8111-111111111111', 'WELCOME50', '₹50 off your basket', 'FLAT', 50.00, 199.00, NULL, TRUE, NULL, 0),
    ('f2222222-2222-4222-8222-222222222222', 'SAVE10', '10% off (max ₹100)', 'PERCENT', 10.00, 199.00, 100.00, TRUE, NULL, 0),
    ('f3333333-3333-4333-8333-333333333333', 'HLM20', '₹20 off any local order', 'FLAT', 20.00, 100.00, NULL, TRUE, NULL, 0)
ON CONFLICT (code) DO NOTHING;
