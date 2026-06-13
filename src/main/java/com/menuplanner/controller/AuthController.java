package com.menuplanner.controller;

import com.menuplanner.domain.AppUser;
import com.menuplanner.domain.Household;
import com.menuplanner.repository.AppUserRepository;
import com.menuplanner.repository.HouseholdRepository;
import com.menuplanner.security.AppUserDetails;
import com.menuplanner.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;
    private final HouseholdRepository householdRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public AuthController(AppUserRepository userRepository,
                          HouseholdRepository householdRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.householdRepository = householdRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest req) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.email(), req.password())
        );
        AppUser user = userRepository.findByEmail(req.email()).orElseThrow();
        String token = jwtUtil.generateToken(user.getEmail());
        return Map.of(
                "token", token,
                "name", user.getName(),
                "householdName", user.getHousehold() != null ? user.getHousehold().getName() : "",
                "admin", user.isAdmin()
        );
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterRequest req) {
        if (userRepository.findByEmail(req.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        Household household = householdRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No household configured"));

        AppUser user = new AppUser();
        user.setName(req.name());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setHousehold(household);
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail());
        return Map.of(
                "token", token,
                "name", user.getName(),
                "householdName", household.getName()
        );
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal AppUserDetails details) {
        AppUser user = details.getAppUser();
        return Map.of(
                "name", user.getName(),
                "email", user.getEmail() != null ? user.getEmail() : "",
                "householdName", user.getHousehold() != null ? user.getHousehold().getName() : "",
                "admin", user.isAdmin()
        );
    }

    record LoginRequest(String email, String password) {}
    record RegisterRequest(String name, String email, String password) {}
}
