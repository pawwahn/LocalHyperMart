CREATE TABLE membership_pack_revisions (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no                 INT NOT NULL,
    selling_enabled            BOOLEAN NOT NULL,
    quarterly_price            NUMERIC(12, 2) NOT NULL,
    quarterly_credits          INT NOT NULL,
    half_year_price            NUMERIC(12, 2) NOT NULL,
    half_year_credits          INT NOT NULL,
    annual_price               NUMERIC(12, 2) NOT NULL,
    annual_credits             INT NOT NULL,
    change_summary             VARCHAR(500) NOT NULL DEFAULT '',
    changed_by                 UUID,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_membership_pack_revisions_version ON membership_pack_revisions (version_no);
CREATE INDEX idx_membership_pack_revisions_created ON membership_pack_revisions (created_at DESC);
