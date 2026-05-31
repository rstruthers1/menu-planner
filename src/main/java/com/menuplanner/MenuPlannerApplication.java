package com.menuplanner;

import com.menuplanner.util.MenuEntryExcelLoader;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;

@SpringBootApplication
public class MenuPlannerApplication {
    public static void main(String[] args) {
        SpringApplication.run(MenuPlannerApplication.class, args);
    }

    @Bean
    @Order(10)
    CommandLineRunner loadInitialData(MenuEntryExcelLoader loader) {
        return args -> loader.loadFromExcel();
    }
}
