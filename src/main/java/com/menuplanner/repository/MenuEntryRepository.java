package com.menuplanner.repository;

import com.menuplanner.domain.MenuEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MenuEntryRepository extends JpaRepository<MenuEntry, Long> {

    // Custom query methods can be defined here if needed
    // For example, to find entries by meal date or day of the week
    // List<MenuEntry> findByMealDate(LocalDate mealDate);
    // List<MenuEntry> findByDayOfWeek(String dayOfWeek);


}
