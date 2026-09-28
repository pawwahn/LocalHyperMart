ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS service_invoice_number VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_service_invoice_number
    ON settlements (service_invoice_number)
    WHERE service_invoice_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS service_invoice_sequences (
    fy          VARCHAR(8) PRIMARY KEY,
    last_value  INTEGER NOT NULL
);

-- Existing paid vendor payouts, oldest payment first within each Indian financial year.
WITH ranked AS (
    SELECT
        s.id,
        ROW_NUMBER() OVER (
            PARTITION BY (
                EXTRACT(YEAR FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int
                - CASE
                    WHEN EXTRACT(MONTH FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int >= 4 THEN 0
                    ELSE 1
                  END
            )
            ORDER BY s.paid_at, s.id
        ) AS seq,
        (
            EXTRACT(YEAR FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int
            - CASE
                WHEN EXTRACT(MONTH FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int >= 4 THEN 0
                ELSE 1
              END
        ) AS fy_start
    FROM settlements s
    WHERE s.status = 'PAID'
      AND s.payee_type = 'VENDOR'
      AND s.paid_at IS NOT NULL
      AND s.service_invoice_number IS NULL
)
UPDATE settlements s
SET service_invoice_number =
    'HLM/SF/'
    || LPAD((r.fy_start % 100)::text, 2, '0')
    || '-'
    || LPAD(((r.fy_start + 1) % 100)::text, 2, '0')
    || '/'
    || LPAD(r.seq::text, 4, '0')
FROM ranked r
WHERE s.id = r.id;

INSERT INTO service_invoice_sequences (fy, last_value)
SELECT
    LPAD((r.fy_start % 100)::text, 2, '0')
        || '-'
        || LPAD(((r.fy_start + 1) % 100)::text, 2, '0'),
    MAX(r.seq)::int
FROM (
    SELECT
        ROW_NUMBER() OVER (
            PARTITION BY (
                EXTRACT(YEAR FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int
                - CASE
                    WHEN EXTRACT(MONTH FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int >= 4 THEN 0
                    ELSE 1
                  END
            )
            ORDER BY s.paid_at, s.id
        ) AS seq,
        (
            EXTRACT(YEAR FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int
            - CASE
                WHEN EXTRACT(MONTH FROM (s.paid_at AT TIME ZONE 'Asia/Kolkata'))::int >= 4 THEN 0
                ELSE 1
              END
        ) AS fy_start
    FROM settlements s
    WHERE s.status = 'PAID'
      AND s.payee_type = 'VENDOR'
      AND s.paid_at IS NOT NULL
) r
GROUP BY r.fy_start
ON CONFLICT (fy) DO UPDATE
SET last_value = GREATEST(service_invoice_sequences.last_value, EXCLUDED.last_value);
