BEGIN;
ALTER TABLE foot_images DROP CONSTRAINT IF EXISTS foot_images_foot_side_check;
ALTER TABLE foot_images ADD CONSTRAINT foot_images_foot_side_check CHECK (foot_side IN ('left', 'right', 'foot'));
COMMIT;
