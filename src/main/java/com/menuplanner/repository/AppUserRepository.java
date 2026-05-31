package com.menuplanner.repository;

import com.menuplanner.domain.AppUser;
import com.menuplanner.domain.Household;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
    List<AppUser> findByHousehold(Household household);
    boolean existsByNameAndHousehold(String name, Household household);
}
