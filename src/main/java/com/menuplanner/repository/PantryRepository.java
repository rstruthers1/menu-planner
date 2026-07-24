package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.PantryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PantryRepository extends JpaRepository<PantryItem, Long> {
    List<PantryItem> findByHouseholdOrderByName(Household household);
    void deleteByHousehold(Household household);
}
