package com.menuplanner.repository;

import com.menuplanner.domain.MenuEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MenuEntryRepository extends JpaRepository<MenuEntry, Long> {

    List<MenuEntry> findByMealDateBetween(LocalDate start, LocalDate end);

    @Query("SELECT DISTINCT m.mealName FROM MenuEntry m WHERE m.mealName IS NOT NULL AND m.mealName <> '' ORDER BY m.mealName")
    List<String> findDistinctMealNames();
}
