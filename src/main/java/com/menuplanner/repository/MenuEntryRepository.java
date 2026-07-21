package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MenuEntryRepository extends JpaRepository<MenuEntry, Long> {
    List<MenuEntry> findAllByHousehold(Household household);
    List<MenuEntry> findByMealDateBetweenAndHousehold(LocalDate start, LocalDate end, Household household);
    List<MenuEntry> findByMealDateLessThanEqualAndHouseholdOrderByMealDateDesc(LocalDate date, Household household);
    boolean existsByMeal(Meal meal);
    List<MenuEntry> findByMealDateAndHousehold(LocalDate date, Household household);
    Page<MenuEntry> findByMealDateLessThanEqualAndHousehold(LocalDate date, Household household, Pageable pageable);

    @Query("SELECT DISTINCT e FROM MenuEntry e " +
           "JOIN FETCH e.meal m " +
           "LEFT JOIN FETCH m.recipe r " +
           "LEFT JOIN FETCH r.ingredients " +
           "WHERE e.mealDate BETWEEN :start AND :end AND e.household = :household")
    List<MenuEntry> findByWeekWithRecipes(@Param("start") LocalDate start,
                                          @Param("end") LocalDate end,
                                          @Param("household") Household household);

    @Query("SELECT COUNT(e) FROM MenuEntry e WHERE e.mealDate > :date AND e.mealDate <= :today AND e.household.id = :householdId")
    long countEntriesNewerThan(@Param("date") LocalDate date, @Param("today") LocalDate today, @Param("householdId") Long householdId);
}
