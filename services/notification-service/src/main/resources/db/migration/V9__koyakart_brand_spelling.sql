-- Standardize SMS / notification sender prefix to KoyaKart (lowercase y).
UPDATE notification_templates
SET body_template = replace(body_template, 'KoYaKart', 'KoyaKart')
WHERE body_template LIKE '%KoYaKart%';

UPDATE notification_templates
SET body_template = replace(body_template, 'HyperLocalMart', 'KoyaKart')
WHERE body_template LIKE '%HyperLocalMart%';
