package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MealRepository extends JpaRepository<Meal, Long> {
    Optional<Meal> findFirstByName(String name);
    Optional<Meal> findByNameAndHousehold(String name, Household household);
    Optional<Meal> findFirstByNameAndSharedTrue(String name);

    @Query("SELECT DISTINCT m.name FROM Meal m WHERE m.household = :household OR m.shared = true ORDER BY m.name")
    List<String> findNamesForHousehold(@Param("household") Household household);

    Optional<Meal> findByIdAndHouseholdId(Long id, Long householdId);

    @Query("SELECT m FROM Meal m WHERE m.household = :household OR m.shared = true ORDER BY m.name")
    List<Meal> findMealsForHousehold(@Param("household") Household household);
}
