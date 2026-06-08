--liquibase formatted sql

--changeset rachel:003-add-sides
ALTER TABLE menu_entry ADD COLUMN sides varchar(500);
--rollback ALTER TABLE menu_entry DROP COLUMN sides;
