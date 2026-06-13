package com.menuplanner.repository;

import com.menuplanner.domain.Meal;
import com.menuplanner.domain.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    Optional<Recipe> findByMeal(Meal meal);
}
