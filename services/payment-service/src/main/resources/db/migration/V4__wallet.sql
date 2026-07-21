CREATE TABLE wallet_accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL UNIQUE,
    balance      DECIMAL(12,2) NOT NULL DEFAULT 0,
    status       VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID
);

CREATE TABLE wallet_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        UUID NOT NULL REFERENCES wallet_accounts(id),
    type             VARCHAR(30) NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    balance_after    DECIMAL(12,2) NOT NULL,
    reference_type   VARCHAR(50) NOT NULL,
    reference_id     UUID NOT NULL,
    order_id         UUID,
    order_item_id    UUID,
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    CONSTRAINT uq_wallet_txn_ref UNIQUE (reference_type, reference_id, type)
);

CREATE INDEX idx_wallet_accounts_user ON wallet_accounts(user_id);
CREATE INDEX idx_wallet_txn_wallet ON wallet_transactions(wallet_id, created_at DESC);
