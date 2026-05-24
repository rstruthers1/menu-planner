package com.menuplanner.controller;

import com.menuplanner.util.TemperatureConverter;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@RestController
public class WeatherController {

    @Value("${weather.latitude}")
    private double latitude;

    @Value("${weather.longitude}")
    private double longitude;

    @GetMapping("/api/weather")
    public Map<String, Object> getWeather(@RequestParam String date) {

        // Forecast API carries 92 days of history; archive API for anything older
        LocalDate requestedDate = LocalDate.parse(date);
        String baseUrl = requestedDate.isBefore(LocalDate.now().minusDays(92))
                ? "https://archive-api.open-meteo.com/v1/archive"
                : "https://api.open-meteo.com/v1/forecast";

        String url = String.format(
                "%s?latitude=%f&longitude=%f&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America/Chicago&start_date=%s&end_date=%s",
                baseUrl, latitude, longitude, date, date
        );

        RestTemplate restTemplate = new RestTemplate();
        String response = restTemplate.getForObject(url, String.class);

        return getStringObjectMap(response);
    }

    private Map<String, Object> getStringObjectMap(String response) {
        JSONObject json = new JSONObject(response);
        JSONObject daily = json.getJSONObject("daily");

        JSONArray tempMax = daily.getJSONArray("temperature_2m_max");
        JSONArray tempMin = daily.getJSONArray("temperature_2m_min");
        JSONArray weatherCodes = daily.getJSONArray("weather_code");

        int highC = tempMax.getInt(0);
        int lowC = tempMin.getInt(0);
        int code = weatherCodes.getInt(0);

        String condition = mapWeatherCode(code);

        Map<String, Object> result = new HashMap<>();
        result.put("high", TemperatureConverter.celsiusToFahrenheit(highC));
        result.put("low", TemperatureConverter.celsiusToFahrenheit(lowC));
        result.put("condition", condition);
        return result;
    }

    private String mapWeatherCode(int code) {
        return switch (code) {
            case 0 -> "Clear";
            case 1, 2 -> "Partly Cloudy";
            case 3 -> "Overcast";
            case 45, 48 -> "Foggy";
            case 51, 53, 55 -> "Drizzle";
            case 61, 63, 65 -> "Rain";
            case 71, 73, 75 -> "Snow";
            case 95 -> "Thunderstorm";
            default -> "Unknown";
        };
    }
}
