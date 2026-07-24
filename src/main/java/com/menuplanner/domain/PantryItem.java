package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "pantry_item")
@Data
public class PantryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id")
    private Household household;
}
