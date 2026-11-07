package com.tabletop.controller;

import com.tabletop.service.AuthService;
import com.tabletop.service.FeedbackService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FeedbackController {
    private final AuthService authService;
    private final FeedbackService feedbackService;

    public FeedbackController(AuthService authService, FeedbackService feedbackService) {
        this.authService = authService;
        this.feedbackService = feedbackService;
    }

    @PostMapping("/api/feedback")
    public Map<String, Object> feedback(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return feedbackService.submit(authService.currentUser(request), body);
    }
}
