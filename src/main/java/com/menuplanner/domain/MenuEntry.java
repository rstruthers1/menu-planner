package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Table(name = "menu_entry")
@Data
public class MenuEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate mealDate;
    private String dayOfWeek;
    private Boolean confirmed;
    private Boolean leftover;
    private LocalDate leftoverFromDate;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "meal_id")
    private Meal meal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id")
    private Household household;
}
