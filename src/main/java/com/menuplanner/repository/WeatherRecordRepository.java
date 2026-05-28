package com.menuplanner.repository;

import com.menuplanner.domain.WeatherRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface WeatherRecordRepository extends JpaRepository<WeatherRecord, Long> {
    Optional<WeatherRecord> findByDate(LocalDate date);
    List<WeatherRecord> findByDateIn(Collection<LocalDate> dates);
}
