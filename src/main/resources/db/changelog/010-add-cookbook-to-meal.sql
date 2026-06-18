--liquibase formatted sql
--changeset rachel:010-add-cookbook-to-meal
ALTER TABLE meal ADD COLUMN cookbook_id bigint REFERENCES cookbook(id);
