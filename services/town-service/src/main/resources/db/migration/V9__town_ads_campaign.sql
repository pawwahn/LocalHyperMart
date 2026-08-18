ALTER TABLE town_ads ADD COLUMN campaign_id UUID;

CREATE INDEX idx_town_ads_campaign ON town_ads (campaign_id);
