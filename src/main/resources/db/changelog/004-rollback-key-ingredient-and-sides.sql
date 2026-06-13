--liquibase formatted sql

--changeset rachel:004-rollback-key-ingredient-and-sides
ALTER TABLE meal DROP COLUMN IF EXISTS key_ingredient;
ALTER TABLE menu_entry DROP COLUMN IF EXISTS sides;
