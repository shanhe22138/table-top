package com.tabletop.controller;

import com.tabletop.model.UserEntity;
import com.tabletop.service.AuthService;
import com.tabletop.service.StateService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StateController {
    private final AuthService authService;
    private final StateService stateService;

    public StateController(AuthService authService, StateService stateService) {
        this.authService = authService;
        this.stateService = stateService;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "table-top", "time", Instant.now().toString());
    }

    @GetMapping("/api/state")
    public Map<String, Object> state(HttpServletRequest request) {
        UserEntity user = authService.currentUser(request);
        return stateService.load(user == null ? null : user.getId());
    }
}
