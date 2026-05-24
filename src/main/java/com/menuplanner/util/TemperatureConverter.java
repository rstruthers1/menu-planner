package com.menuplanner.util;

public class TemperatureConverter {

    private TemperatureConverter() {
        // Private constructor to prevent instantiation
    }

    public static int celsiusToFahrenheit(int celsius) {
        return (int) Math.round((celsius * 9.0 / 5.0) + 32);
    }

    public static double celsiusToFahrenheit(double celsius) {
        return (celsius * 9.0 / 5.0) + 32;
    }

    public static int fahrenheitToCelsius(int fahrenheit) {
        return (int) Math.round((fahrenheit - 32) * 5.0 / 9.0);
    }

    public static double fahrenheitToCelsius(double fahrenheit) {
        return (fahrenheit - 32) * 5.0 / 9.0;
    }

}
