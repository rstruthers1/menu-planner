package com.menuplanner.repository;

import com.menuplanner.domain.Meal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MealRepository extends JpaRepository<Meal, Long> {
    Optional<Meal> findByName(String name);

    @Query("SELECT m.name FROM Meal m ORDER BY m.name")
    List<String> findAllNamesOrdered();
}
