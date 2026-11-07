package com.tabletop.controller;

import com.tabletop.model.UserEntity;
import com.tabletop.service.AuthService;
import com.tabletop.service.SyncService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {
    private final AuthService authService;
    private final SyncService syncService;

    public SyncController(AuthService authService, SyncService syncService) {
        this.authService = authService;
        this.syncService = syncService;
    }

    @PostMapping("/api/sync")
    public Map<String, Object> sync(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        UserEntity user = authService.requireUser(request);
        return syncService.apply(user, body);
    }
}
