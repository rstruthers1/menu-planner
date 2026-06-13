--liquibase formatted sql

--changeset rachel:007-add-admin-flag
ALTER TABLE app_user ADD COLUMN admin boolean NOT NULL DEFAULT false;
