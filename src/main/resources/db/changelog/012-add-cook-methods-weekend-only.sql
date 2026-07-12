--liquibase formatted sql
--changeset rachel:012-add-cook-methods-weekend-only
ALTER TABLE meal ADD COLUMN cook_methods VARCHAR(100);
ALTER TABLE meal ADD COLUMN weekend_only BOOLEAN NOT NULL DEFAULT FALSE;
