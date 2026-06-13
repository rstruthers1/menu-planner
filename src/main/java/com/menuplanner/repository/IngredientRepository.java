package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    Optional<Ingredient> findByNameIgnoreCaseAndHousehold(String name, Household household);
    List<Ingredient> findByHouseholdAndNameContainingIgnoreCaseOrderByName(Household household, String name);
}
