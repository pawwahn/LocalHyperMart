UPDATE ad_rate_cards
SET rates_json = jsonb_pretty(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    rates_json::jsonb,
                    '{HOME_HERO,year}',
                    '{"oneTown": 150000, "extraTown": 50000, "allTowns": 1200000}'::jsonb,
                    true
                ),
                '{HOME_MID_GRID,year}',
                '{"oneTown": 75000, "extraTown": 25000, "allTowns": 600000}'::jsonb,
                true
            ),
            '{CART_UPSELL,year}',
            '{"oneTown": 90000, "extraTown": 32000, "allTowns": 750000}'::jsonb,
            true
        )
    )
WHERE rates_json::jsonb -> 'HOME_HERO' -> 'year' IS NULL;
