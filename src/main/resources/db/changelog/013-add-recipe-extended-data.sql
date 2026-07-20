--liquibase formatted sql

--changeset rachel:013-add-recipe-extended-data
ALTER TABLE recipe ADD COLUMN extended_data TEXT;
