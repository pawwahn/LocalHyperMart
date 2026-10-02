UPDATE notification_templates
SET body_template = replace(body_template, 'HyperLocalMart', 'KoYaKart')
WHERE body_template LIKE '%HyperLocalMart%';
