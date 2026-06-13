package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    Optional<Ingredient> findByNameIgnoreCaseAndHousehold(String name, Household household);
    Optional<Ingredient> findByNameIgnoreCaseAndHouseholdIsNull(String name);
    List<Ingredient> findByHouseholdIsNullOrderByName();

    // Household-owned first, then global; filtered by name fragment
    @Query("""
            SELECT i FROM Ingredient i
            WHERE (i.household = :household OR i.household IS NULL)
            AND (:q = '' OR LOWER(i.name) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY CASE WHEN i.household IS NOT NULL THEN 0 ELSE 1 END, i.name
            """)
    List<Ingredient> findForHouseholdWithQuery(@Param("household") Household household, @Param("q") String q);
}
