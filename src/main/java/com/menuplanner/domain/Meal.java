package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

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

    @Column(length = 100)
    private String cookMethods; // comma-separated: GRILL,OVEN,STOVE,SLOW_COOKER,AIR_FRYER,INSTANT_POT,NO_COOK; null = unspecified

    @Column(columnDefinition = "boolean not null default false")
    private boolean weekendOnly = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cookbook_id")
    private Cookbook cookbook;

    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    @OneToOne(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Recipe recipe;

    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "meal_ingredient",
            joinColumns = @JoinColumn(name = "meal_id"),
            inverseJoinColumns = @JoinColumn(name = "ingredient_id")
    )
    private List<Ingredient> ingredients = new ArrayList<>();

    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "meal_side",
            joinColumns = @JoinColumn(name = "meal_id"),
            inverseJoinColumns = @JoinColumn(name = "side_id")
    )
    private List<Side> sides = new ArrayList<>();
}
