UPDATE delivery_assignments
SET assignment_number = REPLACE(assignment_number, '-PK', '-TO-HUB')
WHERE assignment_number LIKE '%-PK';

UPDATE delivery_assignments
SET assignment_number = REPLACE(assignment_number, '-LM', '-TO-BUYER')
WHERE assignment_number LIKE '%-LM';
