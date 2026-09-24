BEGIN;

ALTER TABLE examinations ADD COLUMN completed_at TIMESTAMPTZ;
UPDATE examinations SET completed_at = updated_at WHERE status IN ('completed', 'reviewed');

ALTER TABLE ai_results
    ADD COLUMN ulcer_detected BOOLEAN,
    ADD COLUMN ulcer_area_percent REAL CHECK (ulcer_area_percent >= 0 AND ulcer_area_percent <= 100),
    ADD COLUMN threshold REAL CHECK (threshold >= 0 AND threshold <= 1);

CREATE UNIQUE INDEX foot_images_image_url_unique_idx ON foot_images (image_url) WHERE image_url LIKE '/api/uploads/original/%';
CREATE UNIQUE INDEX ai_results_mask_url_unique_idx ON ai_results (mask_url) WHERE mask_url LIKE '/api/uploads/overlay/%';

COMMIT;
