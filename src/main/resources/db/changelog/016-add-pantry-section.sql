--liquibase formatted sql
--changeset rachel:016-add-pantry-section
ALTER TABLE pantry_item ADD COLUMN section VARCHAR(50) NOT NULL DEFAULT 'cupboard';
