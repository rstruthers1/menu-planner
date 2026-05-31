package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "meal")
@Data
public class Meal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String recipeLink;
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id")
    private Household household;

    @Column(columnDefinition = "boolean not null default false")
    private boolean shared = false;

    private Integer minTemp;
    private Integer maxTemp;

    @Column(length = 50)
    private String seasons; // comma-separated: SPRING,SUMMER,FALL,WINTER; null = unrestricted
}
