CREATE TABLE beauty_vendor_treatments (
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    service_code    VARCHAR(30) NOT NULL,
    label           VARCHAR(80) NOT NULL,
    hint            VARCHAR(120),
    emoji           VARCHAR(8) NOT NULL DEFAULT '✨',
    PRIMARY KEY (vendor_id, service_code)
);

CREATE INDEX idx_beauty_vendor_treatments_vendor ON beauty_vendor_treatments (vendor_id);
