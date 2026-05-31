package com.menuplanner.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class ResponseLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ResponseLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
        chain.doFilter(request, wrapped);

        byte[] body = wrapped.getContentAsByteArray();
        String bodyStr = body.length > 0 ? new String(body, StandardCharsets.UTF_8) : "(empty)";
        log.info("RESPONSE [{} {}] status={} body={}",
                request.getMethod(), request.getRequestURI(),
                wrapped.getStatus(), bodyStr);

        wrapped.copyBodyToResponse();
    }
}
