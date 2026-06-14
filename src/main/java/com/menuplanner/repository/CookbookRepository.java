package com.menuplanner.repository;

import com.menuplanner.domain.Cookbook;
import com.menuplanner.domain.Household;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CookbookRepository extends JpaRepository<Cookbook, Long> {
    Optional<Cookbook> findByNameIgnoreCaseAndHouseholdIsNull(String name);
    Optional<Cookbook> findByNameIgnoreCaseAndHousehold(String name, Household household);
    List<Cookbook> findByHouseholdIsNullOrderByName();

    @Query("""
            SELECT c FROM Cookbook c
            WHERE c.household = :household OR c.household IS NULL
            ORDER BY CASE WHEN c.household IS NOT NULL THEN 0 ELSE 1 END, c.name
            """)
    List<Cookbook> findAllForHousehold(@Param("household") Household household);
}
