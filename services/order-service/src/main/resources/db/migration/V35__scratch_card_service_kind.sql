ALTER TABLE order_scratch_cards
    ADD COLUMN service_kind VARCHAR(20);

UPDATE order_scratch_cards SET service_kind = 'GROCERY' WHERE service_kind IS NULL;
