package com.menuplanner.controller;

import com.menuplanner.domain.Ingredient;
import com.menuplanner.repository.IngredientRepository;
import com.menuplanner.security.AppUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ingredients")
public class IngredientController {

    private final IngredientRepository ingredientRepository;

    public IngredientController(IngredientRepository ingredientRepository) {
        this.ingredientRepository = ingredientRepository;
    }

    @GetMapping
    public List<String> getSuggestions(@RequestParam(defaultValue = "") String q,
                                       @AuthenticationPrincipal AppUserDetails userDetails) {
        return ingredientRepository.findForHouseholdWithQuery(userDetails.getHousehold(), q)
                .stream().map(Ingredient::getName).collect(Collectors.toList());
    }

    @GetMapping("/global")
    public List<Map<String, Object>> getGlobalIngredients() {
        return ingredientRepository.findByHouseholdIsNullOrderByName()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @PostMapping
    public Map<String, Object> addHouseholdIngredient(@RequestBody IngredientRequest req,
                                                       @AuthenticationPrincipal AppUserDetails userDetails) {
        String name = req.name().trim();
        if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        if (ingredientRepository.findByNameIgnoreCaseAndHousehold(name, userDetails.getHousehold()).isPresent()
                || ingredientRepository.findByNameIgnoreCaseAndHouseholdIsNull(name).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + name + "\" already exists");
        }
        Ingredient ing = new Ingredient();
        ing.setName(name);
        ing.setHousehold(userDetails.getHousehold());
        return toResponse(ingredientRepository.save(ing));
    }

    @PostMapping("/global")
    public Map<String, Object> addGlobalIngredient(@RequestBody IngredientRequest req) {
        String name = req.name().trim();
        if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        if (ingredientRepository.findByNameIgnoreCaseAndHouseholdIsNull(name).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + name + "\" already in global list");
        }
        Ingredient ing = new Ingredient();
        ing.setName(name);
        ing.setHousehold(null);
        return toResponse(ingredientRepository.save(ing));
    }

    @DeleteMapping("/{id}")
    public void deleteIngredient(@PathVariable Long id,
                                  @AuthenticationPrincipal AppUserDetails userDetails) {
        Ingredient ing = ingredientRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean isGlobal = ing.getHousehold() == null;
        if (isGlobal && !userDetails.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can delete global ingredients");
        }
        if (!isGlobal && !ing.getHousehold().getId().equals(userDetails.getHousehold().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete another household's ingredient");
        }
        ingredientRepository.deleteById(id);
    }

    private Map<String, Object> toResponse(Ingredient i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("name", i.getName());
        m.put("global", i.getHousehold() == null);
        return m;
    }

    record IngredientRequest(String name) {}
}
