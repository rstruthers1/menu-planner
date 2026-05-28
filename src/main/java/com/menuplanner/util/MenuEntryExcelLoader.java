
package com.menuplanner.util;

import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.repository.MenuEntryRepository;
import com.menuplanner.repository.WeatherRecordRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Iterator;

@Component
public class MenuEntryExcelLoader {

    private final MenuEntryRepository repository;
    private final MealRepository mealRepository;
    private final WeatherRecordRepository weatherRecordRepository;

    public MenuEntryExcelLoader(MenuEntryRepository repository,
                                MealRepository mealRepository,
                                WeatherRecordRepository weatherRecordRepository) {
        this.repository = repository;
        this.mealRepository = mealRepository;
        this.weatherRecordRepository = weatherRecordRepository;
    }

    public void loadFromExcel() {
        if (repository.count() > 0) return;

        try (InputStream is = new ClassPathResource("data/menu_seed.xlsx").getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rows = sheet.iterator();

            if (rows.hasNext()) rows.next(); // skip header

            while (rows.hasNext()) {
                Row row = rows.next();

                if (row.getPhysicalNumberOfCells() < 3) {
                    System.err.println("Skipping row with insufficient data: " + row.getRowNum());
                    continue;
                }

                LocalDate mealDate = getCellValueAsDate(row, 0);
                String mealName = getCellValue(row, 2);
                String recipeLink = getCellValue(row, 6);
                String notes = getCellValue(row, 7);

                Meal meal = mealRepository.findByName(mealName).orElseGet(() -> {
                    Meal m = new Meal();
                    m.setName(mealName);
                    m.setRecipeLink(recipeLink.isEmpty() ? null : recipeLink);
                    m.setNotes(notes.isEmpty() ? null : notes);
                    return mealRepository.save(m);
                });

                MenuEntry entry = new MenuEntry();
                entry.setMealDate(mealDate);
                entry.setDayOfWeek(getCellValue(row, 1));
                entry.setMeal(meal);
                repository.save(entry);

                // Seed historical weather separately
                if (mealDate != null && row.getPhysicalNumberOfCells() >= 6) {
                    String condition = getCellValue(row, 3);
                    Integer high = getCellValueAsInteger(row, 4);
                    Integer low = getCellValueAsInteger(row, 5);
                    boolean hasWeather = (condition != null && !condition.isEmpty()) || high != null || low != null;
                    if (hasWeather && weatherRecordRepository.findByDate(mealDate).isEmpty()) {
                        WeatherRecord wr = new WeatherRecord();
                        wr.setDate(mealDate);
                        wr.setCondition(condition);
                        wr.setHighTempF(high);
                        wr.setLowTempF(low);
                        weatherRecordRepository.save(wr);
                    }
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String getCellValue(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        return (cell != null) ? cell.toString().trim() : "";
    }

    private Integer getCellValueAsInteger(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case NUMERIC:
                return (int) cell.getNumericCellValue();
            case STRING:
                String text = cell.getStringCellValue().trim();
                if (text.isEmpty()) return null;
                return text.contains(".") ? (int) Double.parseDouble(text) : Integer.parseInt(text);
            default:
                return null;
        }
    }

    private LocalDate getCellValueAsDate(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) return null;

        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        } else {
            String text = cell.toString().trim();
            try {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MMM-yyyy");
                return LocalDate.parse(text, formatter);
            } catch (DateTimeParseException e) {
                System.err.println("Unable to parse date: " + text);
                return null;
            }
        }
    }
}
