package com.menuplanner.service;

import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.util.TemperatureConverter;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class WeatherService {

    @Value("${weather.latitude}")
    private double latitude;

    @Value("${weather.longitude}")
    private double longitude;

    private final WeatherRecordRepository weatherRecordRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    // Cached NWS gridpoint — fetched once on first use
    private volatile String nwsGridId;
    private volatile int nwsGridX;
    private volatile int nwsGridY;

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

        Map<String, Object> result;
        if (date.isBefore(today)) {
            result = fetchFromOpenMeteo(date);
        } else {
            try {
                result = fetchNwsForecast(date);
            } catch (Exception e) {
                // Fall back to Open-Meteo if NWS is unavailable or date is out of range
                result = fetchFromOpenMeteo(date);
            }
        }

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

    // --- NWS (National Weather Service) — used for today and future dates ---

    private synchronized void initNwsGridpoint() {
        if (nwsGridId != null) return;
        String url = String.format(Locale.US, "https://api.weather.gov/points/%.4f,%.4f", latitude, longitude);
        String response = nwsGet(url);
        JSONObject props = new JSONObject(response).getJSONObject("properties");
        nwsGridId = props.getString("gridId");
        nwsGridX = props.getInt("gridX");
        nwsGridY = props.getInt("gridY");
    }

    private Map<String, Object> fetchNwsForecast(LocalDate date) {
        initNwsGridpoint();
        String url = String.format("https://api.weather.gov/gridpoints/%s/%d,%d/forecast", nwsGridId, nwsGridX, nwsGridY);
        JSONArray periods = new JSONObject(nwsGet(url)).getJSONObject("properties").getJSONArray("periods");

        Integer high = null, low = null;
        String condition = null;

        for (int i = 0; i < periods.length(); i++) {
            JSONObject period = periods.getJSONObject(i);
            LocalDate periodDate = LocalDate.parse(period.getString("startTime").substring(0, 10));
            if (!periodDate.equals(date)) continue;
            if (period.getBoolean("isDaytime")) {
                high = period.getInt("temperature");
                condition = mapNwsCondition(period.getString("shortForecast"));
            } else {
                low = period.getInt("temperature");
            }
        }

        if (high == null || low == null) {
            throw new RuntimeException("NWS forecast not available for " + date);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("high", high);
        result.put("low", low);
        result.put("condition", condition != null ? condition : "Unknown");
        return result;
    }

    private String nwsGet(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "menu-planner-app");
        return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class).getBody();
    }

    private String mapNwsCondition(String shortForecast) {
        if (shortForecast == null) return "Unknown";
        String f = shortForecast.toLowerCase();
        if (f.contains("thunder")) return "Thunderstorm";
        if (f.contains("snow shower") || f.contains("flurr")) return "Snow Showers";
        if (f.contains("snow") || f.contains("blizzard")) return "Snow";
        if (f.contains("rain shower") || f.contains("shower")) return "Rain Showers";
        if (f.contains("rain") || f.contains("drizzle")) return "Rain";
        if (f.contains("fog")) return "Foggy";
        if (f.contains("overcast") || f.contains("mostly cloudy") || f.contains("cloudy")) return "Overcast";
        if (f.contains("partly") || f.contains("mostly sunny") || f.contains("mostly clear")) return "Partly Cloudy";
        if (f.contains("sunny") || f.contains("clear")) return "Clear";
        return "Unknown";
    }

    // --- Open-Meteo — used for historical dates and NWS fallback ---

    private Map<String, Object> fetchFromOpenMeteo(LocalDate date) {
        LocalDate today = LocalDate.now();
        String dateStr = date.toString();
        String baseUrl = date.isBefore(today.minusDays(92))
                ? "https://archive-api.open-meteo.com/v1/archive"
                : "https://api.open-meteo.com/v1/forecast";

        String url = String.format(Locale.US,
                "%s?latitude=%.4f&longitude=%.4f&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America/Chicago&start_date=%s&end_date=%s",
                baseUrl, latitude, longitude, dateStr, dateStr);

        String response = restTemplate.getForObject(url, String.class);
        return parseOpenMeteoResponse(response);
    }

    private Map<String, Object> parseOpenMeteoResponse(String response) {
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

    private Map<String, Object> recordToMap(WeatherRecord r) {
        Map<String, Object> m = new HashMap<>();
        m.put("high", r.getHighTempF());
        m.put("low", r.getLowTempF());
        m.put("condition", r.getCondition());
        return m;
    }
}
