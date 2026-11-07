package com.tabletop.service;

import com.alibaba.fastjson2.JSON;
import com.tabletop.exception.ApiException;
import com.tabletop.mapper.DocumentMapper;
import com.tabletop.mapper.UserMapper;
import com.tabletop.model.DocumentEntity;
import com.tabletop.model.UserEntity;
import com.tabletop.util.JsonSupport;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncService {
    private static final Set<String> TABLES = Set.of(
            "users", "games", "reviews", "events", "showcase", "posts", "logs", "charts", "settings", "feedbacks");
    private static final Set<String> PROFILE_FIELDS = Set.of(
            "avatar", "bio", "prefs", "favRoles", "host", "privacy", "showUsername",
            "following", "followers", "likedUsers");

    private final UserMapper userMapper;
    private final DocumentMapper documentMapper;
    private final int maxOps;

    public SyncService(UserMapper userMapper, DocumentMapper documentMapper,
            @org.springframework.beans.factory.annotation.Value("${table-top.max-sync-ops:500}") int maxOps) {
        this.userMapper = userMapper;
        this.documentMapper = documentMapper;
        this.maxOps = maxOps;
    }

    @Transactional
    @CacheEvict(value = "state", allEntries = true)
    public Map<String, Object> apply(UserEntity actor, Map<String, Object> body) {
        Object raw = body.get("ops");
        if (!(raw instanceof List<?> list)) throw ApiException.badRequest("ops 必须是数组");
        if (list.size() > maxOps) throw ApiException.badRequest("一次提交的操作太多");
        List<Map<String, Object>> ops = list.stream().map(JsonSupport::object).toList();
        String transferTarget = detectOwnerTransfer(actor, ops);
        for (Map<String, Object> op : ops) {
            String table = JsonSupport.string(op, "table");
            String type = JsonSupport.string(op, "t");
            if (!TABLES.contains(table)) throw ApiException.badRequest("未知集合：" + table);
            if (!Set.of("insert", "update", "delete").contains(type)) throw ApiException.badRequest("未知操作类型");
            if ("users".equals(table)) applyUser(actor, op, transferTarget);
            else if ("logs".equals(table)) appendLog(actor, op, type);
            else if ("settings".equals(table)) applySettings(actor, op, type);
            else if ("feedbacks".equals(table)) throw ApiException.forbidden("反馈只能通过反馈接口提交");
            else applyDocument(actor, op, table, type);
        }
        return Map.of("ok", true, "applied", ops.size());
    }

    private void applyUser(UserEntity actor, Map<String, Object> op, String transferTarget) {
        if (!"update".equals(JsonSupport.string(op, "t"))) throw ApiException.forbidden("账号只能修改资料");
        String id = requiredId(op);
        Map<String, Object> patch = JsonSupport.object(op.get("patch"));
        UserEntity target = userMapper.findById(id);
        if (target == null) throw ApiException.notFound("账号不存在");
        boolean self = actor.getId().equals(id);
        String nextRole = JsonSupport.string(patch, "role");
        boolean roleChanged = patch.containsKey("role") && !Objects.equals(nextRole, target.getRole());

        if (roleChanged) {
            if (!"owner".equals(actor.getRole())) throw ApiException.forbidden("只有站长能授予管理员");
            if (self) {
                if (transferTarget == null || !"admin".equals(nextRole)) {
                    throw ApiException.forbidden("不能自己改自己的权限");
                }
            } else if ("owner".equals(nextRole) && !id.equals(transferTarget)) {
                throw ApiException.forbidden("站长身份不能直接改，请用转让");
            } else if (!self && !id.equals(transferTarget) && !Set.of("user", "admin").contains(nextRole)) {
                throw ApiException.badRequest("无效的用户权限");
            }
            userMapper.updateRole(id, nextRole, Instant.now());
        }

        if (self) {
            updateSelfProfile(target, patch);
        } else if (hasNonRoleChanges(target, patch)) {
            updateFollowers(actor, target, patch);
        }
    }

    private void updateSelfProfile(UserEntity target, Map<String, Object> patch) {
        Map<String, Object> existing = userMap(target);
        for (String immutable : List.of("id", "username", "uid", "passwordHash", "createdAt")) {
            if (patch.containsKey(immutable) && changed(existing.get(immutable), patch.get(immutable))) {
                throw ApiException.forbidden("账号身份字段不可修改");
            }
        }
        String nickname = patch.containsKey("nickname") ? JsonSupport.string(patch, "nickname").trim() : target.getNickname();
        if (nickname.length() < 2 || nickname.length() > 12) throw ApiException.badRequest("昵称需要 2–12 个字符");
        if (userMapper.findAll().stream().anyMatch(u -> !u.getId().equals(target.getId()) && u.getNickname().equals(nickname))) {
            throw ApiException.conflict("这个昵称被占用了");
        }
        String email = patch.containsKey("email") ? JsonSupport.string(patch, "email") : target.getEmail();
        if (email != null) {
            email = email.trim();
            if (email.isEmpty()) email = null;
        }
        Map<String, Object> profile = JsonSupport.copy(target.getProfile());
        for (String field : PROFILE_FIELDS) {
            if (patch.containsKey(field)) profile.put(field, patch.get(field));
        }
        target.setNickname(nickname);
        target.setEmail(email);
        target.setProfile(profile);
        target.setUpdatedAt(Instant.now());
        userMapper.updateProfile(target);
    }

    private void updateFollowers(UserEntity actor, UserEntity target, Map<String, Object> patch) {
        Map<String, Object> existing = userMap(target);
        for (Map.Entry<String, Object> entry : patch.entrySet()) {
            if (!"followers".equals(entry.getKey()) && changed(existing.get(entry.getKey()), entry.getValue())) {
                throw ApiException.forbidden("不能修改别人的账号");
            }
        }
        List<String> before = stringList(existing.get("followers"));
        List<String> after = stringList(patch.get("followers"));
        Set<String> changedUsers = new HashSet<>(before);
        changedUsers.addAll(after);
        changedUsers.removeIf(id -> before.contains(id) && after.contains(id));
        if (!changedUsers.equals(Set.of(actor.getId())) || before.size() != new HashSet<>(before).size()
                || after.size() != new HashSet<>(after).size()) {
            throw ApiException.forbidden("只能更新自己与该用户的关注关系");
        }
        Map<String, Object> profile = JsonSupport.copy(target.getProfile());
        profile.put("followers", after);
        target.setProfile(profile);
        target.setUpdatedAt(Instant.now());
        userMapper.updateProfile(target);
    }

    private boolean hasNonRoleChanges(UserEntity target, Map<String, Object> patch) {
        Map<String, Object> existing = userMap(target);
        return patch.entrySet().stream().anyMatch(e -> !"role".equals(e.getKey())
                && changed(existing.get(e.getKey()), e.getValue()));
    }

    private Map<String, Object> userMap(UserEntity user) {
        Map<String, Object> result = AuthService.defaultProfile();
        result.putAll(JsonSupport.copy(user.getProfile()));
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("passwordHash", "");
        result.put("nickname", user.getNickname());
        result.put("role", user.getRole());
        result.put("uid", user.getUid());
        result.put("createdAt", user.getCreatedAt().toString());
        return result;
    }

    private void appendLog(UserEntity actor, Map<String, Object> op, String type) {
        if (!"insert".equals(type)) throw ApiException.forbidden("日志只能追加");
        Map<String, Object> row = JsonSupport.object(op.get("row"));
        String id = JsonSupport.string(row, "id");
        if (id == null || id.isBlank()) throw ApiException.badRequest("缺少 id");
        row.put("id", id);
        row.put("userId", actor.getId());
        row.put("userName", actor.getNickname());
        row.put("at", Instant.now().toString());
        insertDocument("logs", row, actor.getId());
    }

    private void applySettings(UserEntity actor, Map<String, Object> op, String type) {
        if (!AuthService.isAdmin(actor)) throw ApiException.forbidden("只有管理员能改站点配置");
        if ("delete".equals(type)) throw ApiException.forbidden("站点配置不能删除");
        DocumentEntity existing = documentMapper.findById("settings", "app");
        Map<String, Object> next = existing == null ? SettingsService.defaults(null) : JsonSupport.copy(existing.getData());
        next.putAll(JsonSupport.object("insert".equals(type) ? op.get("row") : op.get("patch")));
        next.put("id", "app");
        if (existing != null && changed(existing.getData().get("ownerId"), next.get("ownerId"))
                && !"owner".equals(actor.getRole())) {
            throw ApiException.forbidden("只有站长能改站长");
        }
        if (!"owner".equals(actor.getRole()) && existing != null) {
            next.put("feedbackEmail", existing.getData().get("feedbackEmail"));
            next.put("smtp", existing.getData().get("smtp"));
        }
        next.put("updatedAt", Instant.now().toString());
        if (existing == null) insertDocument("settings", next, null);
        else updateDocument(existing, next, null);
    }

    private void applyDocument(UserEntity actor, Map<String, Object> op, String table, String type) {
        if ("insert".equals(type)) {
            Map<String, Object> row = JsonSupport.object(op.get("row"));
            String id = JsonSupport.string(row, "id");
            if (id == null || id.isBlank()) throw ApiException.badRequest("缺少 id");
            row.put("id", id);
            String ownerId = actor.getId();
            switch (table) {
                case "games", "charts" -> {
                    requireAdmin(actor);
                    ownerId = null;
                }
                case "reviews", "showcase" -> {
                    row.put("userId", actor.getId());
                    if ("reviews".equals(table)) row.put("userName", actor.getNickname());
                }
                case "events" -> {
                    row.put("hostId", actor.getId());
                    row.put("hostName", actor.getNickname());
                }
                case "posts" -> {
                    row.put("authorId", actor.getId());
                    row.put("authorName", actor.getNickname());
                    row.put("authorUid", actor.getUid());
                    row.put("likes", List.of());
                    row.put("comments", List.of());
                }
                default -> throw ApiException.badRequest("未知集合：" + table);
            }
            insertDocument(table, row, ownerId);
            return;
        }

        String id = requiredId(op);
        DocumentEntity existing = documentMapper.findById(table, id);
        if (existing == null) throw ApiException.notFound("数据不存在");
        Map<String, Object> oldRow = existing.getData();
        if ("delete".equals(type)) {
            String ownerField = switch (table) {
                case "events" -> "hostId";
                case "posts" -> "authorId";
                default -> null;
            };
            if (ownerField != null && !actor.getId().equals(oldRow.get(ownerField))) {
                throw ApiException.forbidden("无权删除这条数据");
            }
            checkDocumentOwner(actor, table, oldRow);
            documentMapper.delete(table, id);
            return;
        }

        Map<String, Object> next = JsonSupport.copy(oldRow);
        next.putAll(JsonSupport.object(op.get("patch")));
        next.put("id", id);
        checkDocumentOwner(actor, table, oldRow);
        if ("events".equals(table) && !actor.getId().equals(oldRow.get("hostId"))) {
            if (!onlyChanged(oldRow, next, Set.of("seats")) || !participates(oldRow, actor.getId())
                    && !participates(next, actor.getId())) {
                throw ApiException.forbidden("只能修改自己参与活动的座位");
            }
            next.put("hostId", oldRow.get("hostId"));
        }
        if ("posts".equals(table)) {
            if (!actor.getId().equals(oldRow.get("authorId")) && !onlyChanged(oldRow, next, Set.of("likes", "comments"))) {
                throw ApiException.forbidden("只能修改动态的点赞和评论");
            }
            validatePostSocial(actor, oldRow, next);
            next.put("authorId", oldRow.get("authorId"));
            next.put("authorName", oldRow.get("authorName"));
            next.put("authorUid", oldRow.get("authorUid"));
        }
        if ("reviews".equals(table) || "showcase".equals(table)) next.put("userId", oldRow.get("userId"));
        if ("events".equals(table)) next.put("hostId", oldRow.get("hostId"));
        updateDocument(existing, next, existing.getOwnerId());
    }

    private void checkDocumentOwner(UserEntity actor, String table, Map<String, Object> oldRow) {
        if ("games".equals(table) || "charts".equals(table)) {
            requireAdmin(actor);
            return;
        }
        String ownerField = switch (table) {
            case "reviews", "showcase" -> "userId";
            case "events" -> "hostId";
            case "posts" -> "authorId";
            default -> null;
        };
        if (ownerField == null) throw ApiException.forbidden("无权写入");
        if (!actor.getId().equals(oldRow.get(ownerField)) && !"events".equals(table) && !"posts".equals(table)) {
            throw ApiException.forbidden("无权修改这条数据");
        }
    }

    private void validatePostSocial(UserEntity actor, Map<String, Object> oldRow, Map<String, Object> next) {
        List<String> oldLikes = stringList(oldRow.get("likes"));
        List<String> newLikes = stringList(next.get("likes"));
        Set<String> difference = new HashSet<>(oldLikes);
        difference.addAll(newLikes);
        difference.removeIf(id -> oldLikes.contains(id) && newLikes.contains(id));
        if (!difference.isEmpty() && !difference.equals(Set.of(actor.getId()))) {
            throw ApiException.forbidden("不能代替其他用户点赞");
        }
        List<Map<String, Object>> oldComments = objectList(oldRow.get("comments"));
        List<Map<String, Object>> newComments = objectList(next.get("comments"));
        if (newComments.size() < oldComments.size()) throw ApiException.forbidden("不能删除其他评论");
        for (int i = 0; i < oldComments.size(); i++) {
            if (changed(oldComments.get(i), newComments.get(i))) throw ApiException.forbidden("不能修改已有评论");
        }
        for (int i = oldComments.size(); i < newComments.size(); i++) {
            Map<String, Object> comment = newComments.get(i);
            if (!actor.getId().equals(comment.get("authorId"))) throw ApiException.forbidden("评论作者无效");
            comment.put("authorName", actor.getNickname());
            comment.put("authorUid", actor.getUid());
        }
    }

    private String detectOwnerTransfer(UserEntity actor, List<Map<String, Object>> ops) {
        if (!"owner".equals(actor.getRole())) return null;
        String target = null;
        boolean selfDemoted = false;
        for (Map<String, Object> op : ops) {
            if (!"users".equals(op.get("table")) || !"update".equals(op.get("t"))) continue;
            Map<String, Object> patch = JsonSupport.object(op.get("patch"));
            String role = JsonSupport.string(patch, "role");
            if ("owner".equals(role)) {
                target = requiredId(op);
                if (actor.getId().equals(target)) return null;
            }
            if (actor.getId().equals(requiredId(op)) && "admin".equals(role)) selfDemoted = true;
        }
        if (target == null || !selfDemoted) return null;
        UserEntity user = userMapper.findById(target);
        if (user == null || "owner".equals(user.getRole())) throw ApiException.badRequest("站长转让目标无效");
        final String expected = target;
        boolean settingsMatches = ops.stream().anyMatch(op -> "settings".equals(op.get("table"))
                && expected.equals(JsonSupport.string(JsonSupport.object(op.get("patch")), "ownerId")));
        if (!settingsMatches) throw ApiException.badRequest("站长转让必须同时更新站点配置");
        return target;
    }

    private boolean participates(Map<String, Object> event, String userId) {
        Object seats = event.get("seats");
        if (!(seats instanceof List<?> list)) return false;
        return list.stream().map(JsonSupport::object).anyMatch(seat -> userId.equals(seat.get("userId")));
    }

    private boolean onlyChanged(Map<String, Object> before, Map<String, Object> after, Set<String> allowed) {
        Set<String> keys = new HashSet<>(before.keySet());
        keys.addAll(after.keySet());
        return keys.stream().filter(key -> changed(before.get(key), after.get(key))).allMatch(allowed::contains);
    }

    private void requireAdmin(UserEntity actor) {
        if (!AuthService.isAdmin(actor)) throw ApiException.forbidden("只有管理员能执行此操作");
    }

    private String requiredId(Map<String, Object> op) {
        String id = JsonSupport.string(op, "id");
        if (id == null || id.isBlank()) throw ApiException.badRequest("缺少 id");
        return id;
    }

    private void insertDocument(String collection, Map<String, Object> data, String ownerId) {
        DocumentEntity document = new DocumentEntity();
        document.setCollection(collection);
        document.setId(JsonSupport.string(data, "id"));
        document.setOwnerId(ownerId);
        document.setData(data);
        document.setUpdatedAt(Instant.now());
        documentMapper.insert(document);
    }

    private void updateDocument(DocumentEntity existing, Map<String, Object> data, String ownerId) {
        existing.setData(data);
        existing.setOwnerId(ownerId);
        existing.setUpdatedAt(Instant.now());
        documentMapper.update(existing);
    }

    private static boolean changed(Object before, Object after) {
        return !Objects.equals(JSON.toJSONString(before), JSON.toJSONString(after));
    }

    private static List<String> stringList(Object value) {
        if (value == null) return new ArrayList<>();
        if (!(value instanceof List<?> list)) throw ApiException.badRequest("字段必须是数组");
        return list.stream().map(String::valueOf).toList();
    }

    private static List<Map<String, Object>> objectList(Object value) {
        if (value == null) return new ArrayList<>();
        if (!(value instanceof List<?> list)) throw ApiException.badRequest("字段必须是数组");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) result.add(JsonSupport.object(item));
        return result;
    }
}
