package com.menuplanner.domain;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "app_user")
@Data
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true)
    private String email;

    private String passwordHash;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "household_id")
    private Household household;
}
