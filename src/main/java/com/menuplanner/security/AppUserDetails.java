package com.menuplanner.security;

import com.menuplanner.domain.AppUser;
import com.menuplanner.domain.Household;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class AppUserDetails implements UserDetails {

    private final AppUser user;

    public AppUserDetails(AppUser user) {
        this.user = user;
    }

    public AppUser getAppUser() { return user; }
    public Household getHousehold() { return user.getHousehold(); }

    @Override public String getUsername() { return user.getEmail(); }
    @Override public String getPassword() { return user.getPasswordHash(); }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
