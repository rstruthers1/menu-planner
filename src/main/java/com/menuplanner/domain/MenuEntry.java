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
    private String mealName;
    private String weather;
    private Integer highTempF;
    private Integer lowTempF;
    private String recipeLink;
    private String notes;
}
