CREATE TABLE delivery_agent_ratings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             UUID NOT NULL UNIQUE REFERENCES orders(id),
    buyer_id             UUID NOT NULL,
    town_id              UUID NOT NULL,
    agent_id             UUID NOT NULL,
    agent_name_snapshot  VARCHAR(120),
    stars                SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment              VARCHAR(400),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_agent_ratings_agent ON delivery_agent_ratings (agent_id, created_at DESC);
CREATE INDEX idx_delivery_agent_ratings_town ON delivery_agent_ratings (town_id, created_at DESC);
