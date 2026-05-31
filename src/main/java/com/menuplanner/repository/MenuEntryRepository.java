package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.MenuEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MenuEntryRepository extends JpaRepository<MenuEntry, Long> {
    List<MenuEntry> findAllByHousehold(Household household);
    List<MenuEntry> findByMealDateBetweenAndHousehold(LocalDate start, LocalDate end, Household household);
    List<MenuEntry> findByMealDateLessThanEqualAndHouseholdOrderByMealDateDesc(LocalDate date, Household household);

}
