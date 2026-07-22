--liquibase formatted sql
--changeset rachel:014-add-meal-ingredient-table
CREATE TABLE meal_ingredient (
    meal_id BIGINT NOT NULL,
    ingredient_id BIGINT NOT NULL,
    PRIMARY KEY (meal_id, ingredient_id),
    FOREIGN KEY (meal_id) REFERENCES meal(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredient(id)
);
