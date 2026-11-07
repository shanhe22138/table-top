package com.tabletop.service;

import com.tabletop.mapper.DocumentMapper;
import com.tabletop.mapper.UserMapper;
import com.tabletop.model.DocumentEntity;
import com.tabletop.model.UserEntity;
import com.tabletop.util.JsonSupport;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class StateService {
    private static final List<String> COLLECTIONS = List.of(
            "games", "reviews", "events", "showcase", "posts", "charts", "settings");

    private final UserMapper userMapper;
    private final DocumentMapper documentMapper;

    public StateService(UserMapper userMapper, DocumentMapper documentMapper) {
        this.userMapper = userMapper;
        this.documentMapper = documentMapper;
    }

    @Cacheable(value = "state", key = "#userId == null ? 'anonymous' : #userId")
    public Map<String, Object> load(String userId) {
        UserEntity current = userId == null ? null : userMapper.findById(userId);
        boolean admin = AuthService.isAdmin(current);
        boolean owner = current != null && "owner".equals(current.getRole());

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("version", 3);
        List<Map<String, Object>> users = new ArrayList<>();
        for (UserEntity user : userMapper.findAll()) users.add(publicUser(user, current));
        state.put("users", users);
        for (String collection : COLLECTIONS) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (DocumentEntity document : documentMapper.findByCollection(collection)) {
                Map<String, Object> row = JsonSupport.copy(document.getData());
                if ("settings".equals(collection) && !owner) {
                    row.put("feedbackEmail", "");
                    row.put("smtp", null);
                }
                rows.add(row);
            }
            state.put(collection, rows);
        }
        state.put("logs", admin ? data(documentMapper.findRecent("logs", 400)) : List.of());
        state.put("feedbacks", admin ? data(documentMapper.findByCollection("feedbacks")) : List.of());
        state.put("sessionUserId", current == null ? null : current.getId());
        return state;
    }

    private Map<String, Object> publicUser(UserEntity user, UserEntity current) {
        Map<String, Object> result = AuthService.defaultProfile();
        if (user.getProfile() != null) result.putAll(JsonSupport.copy(user.getProfile()));
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("passwordHash", "");
        result.put("nickname", user.getNickname());
        result.put("role", user.getRole());
        result.put("uid", user.getUid());
        result.put("createdAt", user.getCreatedAt().toString());
        if (current == null || !current.getId().equals(user.getId())) result.put("likedUsers", List.of());
        return result;
    }

    private List<Map<String, Object>> data(List<DocumentEntity> documents) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (DocumentEntity document : documents) rows.add(JsonSupport.copy(document.getData()));
        return rows;
    }
}
