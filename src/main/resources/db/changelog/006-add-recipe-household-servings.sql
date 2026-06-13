--liquibase formatted sql

--changeset rachel:006-add-recipe-household-servings
ALTER TABLE recipe ADD COLUMN household_id bigint REFERENCES household(id);
ALTER TABLE recipe ADD COLUMN servings integer;
UPDATE recipe r SET household_id = (SELECT m.household_id FROM meal m WHERE m.id = r.meal_id) WHERE r.meal_id IS NOT NULL;
