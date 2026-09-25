CREATE TABLE referral_codes (
    user_id     UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    code        VARCHAR(16) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE referral_attributions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_user_id         UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    referrer_user_id        UUID NOT NULL REFERENCES users (id),
    referral_code           VARCHAR(16) NOT NULL,
    referee_reward_credited BOOLEAN NOT NULL DEFAULT FALSE,
    referrer_reward_credited BOOLEAN NOT NULL DEFAULT FALSE,
    qualifying_order_id     UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referrer_credited_at    TIMESTAMPTZ
);

CREATE INDEX idx_referral_attributions_referrer ON referral_attributions (referrer_user_id);
