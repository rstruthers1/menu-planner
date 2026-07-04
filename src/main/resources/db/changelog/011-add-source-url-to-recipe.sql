--liquibase formatted sql
--changeset rachel:011-add-source-url-to-recipe
ALTER TABLE recipe ADD COLUMN source_url varchar(1000);
