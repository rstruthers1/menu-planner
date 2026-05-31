package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "household")
@Data
public class Household {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
}
