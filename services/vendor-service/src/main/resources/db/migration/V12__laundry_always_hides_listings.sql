UPDATE vendor_services
SET hides_listings = TRUE,
    updated_at = NOW()
WHERE lower(name) LIKE '%laundry%'
  AND hides_listings = FALSE;

UPDATE vendors v
SET service_id = (
    SELECT s.id
    FROM vendor_services s
    WHERE lower(s.name) LIKE '%laundry%'
    ORDER BY CASE WHEN lower(s.name) = 'laundry' THEN 0 ELSE 1 END, s.sort_order
    LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM laundry_profiles p WHERE p.vendor_id = v.id)
  AND (
      v.service_id IS NULL
      OR NOT EXISTS (
          SELECT 1
          FROM vendor_services s2
          WHERE s2.id = v.service_id
            AND lower(s2.name) LIKE '%laundry%'
      )
  );
