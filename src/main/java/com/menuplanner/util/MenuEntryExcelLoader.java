
package com.menuplanner.util;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.repository.MenuEntryRepository;
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

    public MenuEntryExcelLoader(MenuEntryRepository repository) {
        this.repository = repository;
    }

    public void loadFromExcel() {
        if (repository.count() > 0) return; // already seeded — don't add duplicates

        try (InputStream is = new ClassPathResource("data/menu_seed.xlsx").getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rows = sheet.iterator();

            // Skip header
            if (rows.hasNext()) rows.next();

            while (rows.hasNext()) {
                Row row = rows.next();

                // Ensure the row has enough cells to avoid IndexOutOfBoundsException
                if (row.getPhysicalNumberOfCells() < 6) {
                    System.err.println("Skipping row with insufficient data: " + row.getRowNum());
                    continue;
                }
                MenuEntry entry = new MenuEntry();
                entry.setMealDate(getCellValueAsDate(row, 0));
                entry.setDayOfWeek(getCellValue(row, 1));
                entry.setMealName(getCellValue(row, 2));
                entry.setWeather(getCellValue(row, 3));
                entry.setHighTempF(getCellValueAsInteger(row, 4));
                entry.setLowTempF(getCellValueAsInteger(row, 5));
                entry.setRecipeLink(getCellValue(row, 6));
                entry.setNotes(getCellValue(row, 7));

                repository.save(entry);
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
                return (int) cell.getNumericCellValue(); // safely cast to int
            case STRING:
                String text = cell.getStringCellValue().trim();
                if (text.contains(".")) {
                    return (int) Double.parseDouble(text);  // safely handle "83.0"
                } else {
                    return Integer.parseInt(text);
                }
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
                // Try parsing format like "02-Jul-2025"
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MMM-yyyy");
                return LocalDate.parse(text, formatter);
            } catch (DateTimeParseException e) {
                System.err.println("Unable to parse date: " + text);
                return null;
            }
        }
    }
}
