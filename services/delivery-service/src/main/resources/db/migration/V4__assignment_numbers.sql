ALTER TABLE delivery_assignments
    ADD COLUMN assignment_number VARCHAR(60),
    ADD COLUMN order_number VARCHAR(40),
    ADD COLUMN sub_order_number VARCHAR(50);

CREATE UNIQUE INDEX idx_delivery_assignments_number
    ON delivery_assignments(assignment_number)
    WHERE assignment_number IS NOT NULL;
