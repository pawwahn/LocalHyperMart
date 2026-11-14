-- Repair truncated / legacy lab type codes written before PRIV_LAB / HOSP_LAB converter.
UPDATE vendors v
SET service_for = 'PRIV_LAB'
FROM vendor_services s
WHERE v.service_id = s.id
  AND (LOWER(s.name) LIKE '%diagnostic%' OR LOWER(s.name) LIKE '%lab%')
  AND UPPER(v.service_for) IN ('PRIVATE_LAB', 'PRIVATE_LA', 'PRIVATE');

UPDATE vendors v
SET service_for = 'HOSP_LAB'
FROM vendor_services s
WHERE v.service_id = s.id
  AND (LOWER(s.name) LIKE '%diagnostic%' OR LOWER(s.name) LIKE '%lab%')
  AND UPPER(v.service_for) IN ('HOSPITAL_LAB', 'HOSPITAL_LA', 'HOSPITAL');

UPDATE vendor_registration_requests r
SET service_for = 'PRIV_LAB'
FROM vendor_services s
WHERE r.service_id = s.id
  AND (LOWER(s.name) LIKE '%diagnostic%' OR LOWER(s.name) LIKE '%lab%')
  AND UPPER(r.service_for) IN ('PRIVATE_LAB', 'PRIVATE_LA', 'PRIVATE');

UPDATE vendor_registration_requests r
SET service_for = 'HOSP_LAB'
FROM vendor_services s
WHERE r.service_id = s.id
  AND (LOWER(s.name) LIKE '%diagnostic%' OR LOWER(s.name) LIKE '%lab%')
  AND UPPER(r.service_for) IN ('HOSPITAL_LAB', 'HOSPITAL_LA', 'HOSPITAL');
