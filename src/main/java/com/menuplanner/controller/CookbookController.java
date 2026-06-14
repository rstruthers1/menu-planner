package com.menuplanner.controller;

import com.menuplanner.domain.Cookbook;
import com.menuplanner.domain.Household;
import com.menuplanner.repository.CookbookRepository;
import com.menuplanner.repository.RecipeRepository;
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
@RequestMapping("/api/cookbooks")
public class CookbookController {

    private final CookbookRepository cookbookRepository;
    private final RecipeRepository recipeRepository;

    public CookbookController(CookbookRepository cookbookRepository, RecipeRepository recipeRepository) {
        this.cookbookRepository = cookbookRepository;
        this.recipeRepository = recipeRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getCookbooks(@AuthenticationPrincipal AppUserDetails userDetails) {
        return cookbookRepository.findAllForHousehold(userDetails.getHousehold())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @GetMapping("/global")
    public List<Map<String, Object>> getGlobalCookbooks() {
        return cookbookRepository.findByHouseholdIsNullOrderByName()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @PostMapping
    public Map<String, Object> createCookbook(@RequestBody CookbookRequest req,
                                               @AuthenticationPrincipal AppUserDetails userDetails) {
        String name = req.name().trim();
        if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        if (cookbookRepository.findByNameIgnoreCaseAndHousehold(name, userDetails.getHousehold()).isPresent()
                || cookbookRepository.findByNameIgnoreCaseAndHouseholdIsNull(name).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + name + "\" already exists");
        }
        Cookbook cb = new Cookbook();
        cb.setName(name);
        cb.setHousehold(userDetails.getHousehold());
        return toResponse(cookbookRepository.save(cb));
    }

    @PostMapping("/global")
    public Map<String, Object> createGlobalCookbook(@RequestBody CookbookRequest req) {
        String name = req.name().trim();
        if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        if (cookbookRepository.findByNameIgnoreCaseAndHouseholdIsNull(name).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + name + "\" already in global list");
        }
        Cookbook cb = new Cookbook();
        cb.setName(name);
        cb.setHousehold(null);
        return toResponse(cookbookRepository.save(cb));
    }

    @DeleteMapping("/{id}")
    public void deleteCookbook(@PathVariable Long id,
                                @AuthenticationPrincipal AppUserDetails userDetails) {
        Cookbook cb = cookbookRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean isGlobal = cb.getHousehold() == null;
        if (isGlobal && !userDetails.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can delete global cookbooks");
        }
        if (!isGlobal && !cb.getHousehold().getId().equals(userDetails.getHousehold().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete another household's cookbook");
        }
        long inUse = recipeRepository.countByCookbook(cb);
        if (inUse > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "\"" + cb.getName() + "\" is used by " + inUse + " recipe" + (inUse == 1 ? "" : "s") + " — unlink them first.");
        }
        cookbookRepository.deleteById(id);
    }

    private Map<String, Object> toResponse(Cookbook cb) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", cb.getId());
        m.put("name", cb.getName());
        m.put("global", cb.getHousehold() == null);
        return m;
    }

    record CookbookRequest(String name) {}
}
