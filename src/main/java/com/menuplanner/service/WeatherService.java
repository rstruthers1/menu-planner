package com.menuplanner.service;

import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.util.TemperatureConverter;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class WeatherService {

    @Value("${weather.latitude}")
    private double latitude;

    @Value("${weather.longitude}")
    private double longitude;

    private final WeatherRecordRepository weatherRecordRepository;

    public WeatherService(WeatherRecordRepository weatherRecordRepository) {
        this.weatherRecordRepository = weatherRecordRepository;
    }

    public Map<String, Object> getWeather(LocalDate date) {
        LocalDate today = LocalDate.now();
        if (date.isBefore(today)) {
            return weatherRecordRepository.findByDate(date)
                    .map(this::recordToMap)
                    .orElseGet(() -> fetchAndMaybeCache(date, true));
        }
        return fetchAndMaybeCache(date, false);
    }

    public Optional<WeatherRecord> ensureCached(LocalDate date) {
        Optional<WeatherRecord> existing = weatherRecordRepository.findByDate(date);
        if (existing.isPresent()) return existing;
        try {
            getWeather(date);
        } catch (Exception ignored) {}
        return weatherRecordRepository.findByDate(date);
    }

    private Map<String, Object> fetchAndMaybeCache(LocalDate date, boolean cache) {
        LocalDate today = LocalDate.now();
        String dateStr = date.toString();
        String baseUrl = date.isBefore(today.minusDays(92))
                ? "https://archive-api.open-meteo.com/v1/archive"
                : "https://api.open-meteo.com/v1/forecast";

        String url = String.format(
                "%s?latitude=%f&longitude=%f&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America/Chicago&start_date=%s&end_date=%s",
                baseUrl, latitude, longitude, dateStr, dateStr
        );

        String response = new RestTemplate().getForObject(url, String.class);
        Map<String, Object> result = parseResponse(response);

        if (cache) {
            WeatherRecord record = new WeatherRecord();
            record.setDate(date);
            record.setCondition((String) result.get("condition"));
            record.setHighTempF((Integer) result.get("high"));
            record.setLowTempF((Integer) result.get("low"));
            try {
                weatherRecordRepository.save(record);
            } catch (DataIntegrityViolationException ignored) {}
        }

        return result;
    }

    private Map<String, Object> recordToMap(WeatherRecord r) {
        Map<String, Object> m = new HashMap<>();
        m.put("high", r.getHighTempF());
        m.put("low", r.getLowTempF());
        m.put("condition", r.getCondition());
        return m;
    }

    private Map<String, Object> parseResponse(String response) {
        JSONObject daily = new JSONObject(response).getJSONObject("daily");
        double highC = daily.getJSONArray("temperature_2m_max").getDouble(0);
        double lowC = daily.getJSONArray("temperature_2m_min").getDouble(0);
        int code = daily.getJSONArray("weather_code").getInt(0);

        Map<String, Object> result = new HashMap<>();
        result.put("high", (int) Math.round(TemperatureConverter.celsiusToFahrenheit(highC)));
        result.put("low", (int) Math.round(TemperatureConverter.celsiusToFahrenheit(lowC)));
        result.put("condition", mapWeatherCode(code));
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
            case 71, 73, 75, 77 -> "Snow";
            case 80, 81, 82 -> "Rain Showers";
            case 85, 86 -> "Snow Showers";
            case 95, 96, 99 -> "Thunderstorm";
            default -> "Unknown";
        };
    }
}
