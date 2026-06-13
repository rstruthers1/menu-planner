package com.menuplanner.repository;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Side;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SideRepository extends JpaRepository<Side, Long> {
    Optional<Side> findByNameIgnoreCaseAndHousehold(String name, Household household);
    List<Side> findByHouseholdAndNameContainingIgnoreCaseOrderByName(Household household, String name);
}
