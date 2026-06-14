package com.menuplanner.repository;

import com.menuplanner.domain.Cookbook;
import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.domain.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    Optional<Recipe> findByMeal(Meal meal);
    long countByCookbook(Cookbook cookbook);

    @Query("SELECT r FROM Recipe r LEFT JOIN r.meal m WHERE r.household = :household OR (m IS NOT NULL AND m.household = :household) ORDER BY r.name")
    List<Recipe> findAllForHousehold(@Param("household") Household household);

    @Query("SELECT r FROM Recipe r LEFT JOIN r.meal m WHERE r.id = :id AND (r.household.id = :hid OR (m IS NOT NULL AND m.household.id = :hid))")
    Optional<Recipe> findByIdForHousehold(@Param("id") Long id, @Param("hid") Long hid);
}
