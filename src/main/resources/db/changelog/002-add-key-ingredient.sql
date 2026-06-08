--liquibase formatted sql

--changeset rachel:002-add-key-ingredient
ALTER TABLE meal ADD COLUMN key_ingredient varchar(255);
--rollback ALTER TABLE meal DROP COLUMN key_ingredient;
