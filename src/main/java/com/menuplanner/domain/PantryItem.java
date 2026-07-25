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

    @Column(length = 50)
    private String section; // refrigerator | freezer | cupboard

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id")
    private Household household;
}
