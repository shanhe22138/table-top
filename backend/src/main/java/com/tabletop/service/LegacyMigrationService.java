package com.tabletop.service;

import com.alibaba.fastjson2.JSON;
import com.tabletop.exception.ApiException;
import com.tabletop.mapper.DocumentMapper;
import com.tabletop.mapper.MetaMapper;
import com.tabletop.mapper.UserMapper;
import com.tabletop.model.DocumentEntity;
import com.tabletop.model.UserEntity;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LegacyMigrationService {
    private final UserMapper userMapper;
    private final DocumentMapper documentMapper;
    private final MetaMapper metaMapper;
    private final String sqlitePath;

    public LegacyMigrationService(UserMapper userMapper, DocumentMapper documentMapper, MetaMapper metaMapper,
            @Value("${table-top.sqlite-import:}") String sqlitePath) {
        this.userMapper = userMapper;
        this.documentMapper = documentMapper;
        this.metaMapper = metaMapper;
        this.sqlitePath = sqlitePath == null ? "" : sqlitePath.trim();
    }

    @Transactional
    public void importIfConfigured() {
        if (sqlitePath.isEmpty()) return;
        if (userMapper.count() != 0 || documentMapper.count() != 0) {
            throw new IllegalStateException("SQLite 导入仅允许在空业务库执行");
        }
        Path source = Path.of(sqlitePath).toAbsolutePath().normalize();
        try (Connection sqlite = DriverManager.getConnection("jdbc:sqlite:" + source.toUri() + "?mode=ro")) {
            Map<String, Map<String, Object>> profiles = readProfiles(sqlite);
            boolean hasRole = hasColumn(sqlite, "users", "role");
            boolean hasUid = hasColumn(sqlite, "users", "uid");
            String roleColumn = hasRole ? "role" : "NULL AS role";
            String uidColumn = hasUid ? "uid" : "NULL AS uid";
            boolean first = true;
            try (Statement statement = sqlite.createStatement(); ResultSet rows = statement.executeQuery(
                    "SELECT id, username, email, nickname, pass_hash, salt, created_at, " + roleColumn + ", " + uidColumn
                            + " FROM users ORDER BY created_at, id")) {
                while (rows.next()) {
                    UserEntity user = new UserEntity();
                    user.setId(rows.getString("id"));
                    user.setUsername(rows.getString("username"));
                    user.setEmail(rows.getString("email"));
                    user.setNickname(rows.getString("nickname"));
                    user.setPasswordHash("scrypt:" + rows.getString("pass_hash"));
                    user.setPasswordSalt(rows.getString("salt"));
                    String role = rows.getString("role");
                    user.setRole(role == null || role.isBlank() ? (first ? "owner" : "user") : role);
                    String uid = rows.getString("uid");
                    user.setUid(uid == null || uid.isBlank()
                            ? "U" + user.getId().replaceAll("[^a-zA-Z0-9]", "").substring(
                                    Math.max(0, user.getId().replaceAll("[^a-zA-Z0-9]", "").length() - 6)).toUpperCase()
                            : uid);
                    Map<String, Object> profile = AuthService.defaultProfile();
                    profile.putAll(profiles.getOrDefault(user.getId(), Map.of()));
                    user.setProfile(profile);
                    user.setCreatedAt(Instant.parse(rows.getString("created_at")));
                    user.setUpdatedAt(Instant.now());
                    userMapper.insert(user);
                    first = false;
                }
            }
            try (Statement statement = sqlite.createStatement(); ResultSet rows = statement.executeQuery(
                    "SELECT collection, id, owner_id, data, updated_at FROM docs WHERE collection <> 'users' ORDER BY rowid")) {
                while (rows.next()) {
                    DocumentEntity document = new DocumentEntity();
                    document.setCollection(rows.getString("collection"));
                    document.setId(rows.getString("id"));
                    document.setOwnerId(rows.getString("owner_id"));
                    document.setData(JSON.parseObject(rows.getString("data")));
                    document.setUpdatedAt(Instant.parse(rows.getString("updated_at")));
                    documentMapper.insert(document);
                }
            }
            if (hasTable(sqlite, "meta")) {
                try (Statement statement = sqlite.createStatement();
                        ResultSet rows = statement.executeQuery("SELECT v FROM meta WHERE k = 'auth_secret'")) {
                    if (rows.next()) metaMapper.upsert("auth_secret", rows.getString("v"));
                }
            }
        } catch (ApiException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException("SQLite 数据导入失败：" + error.getMessage(), error);
        }
    }

    private boolean hasColumn(Connection sqlite, String table, String column) throws Exception {
        try (Statement statement = sqlite.createStatement();
                ResultSet rows = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rows.next()) if (column.equals(rows.getString("name"))) return true;
        }
        return false;
    }

    private boolean hasTable(Connection sqlite, String table) throws Exception {
        try (Statement statement = sqlite.createStatement(); ResultSet rows = statement.executeQuery(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '" + table + "'")) {
            return rows.next();
        }
    }

    private Map<String, Map<String, Object>> readProfiles(Connection sqlite) throws Exception {
        Map<String, Map<String, Object>> profiles = new LinkedHashMap<>();
        try (Statement statement = sqlite.createStatement(); ResultSet rows = statement.executeQuery(
                "SELECT id, data FROM docs WHERE collection = 'users'")) {
            while (rows.next()) profiles.put(rows.getString("id"), JSON.parseObject(rows.getString("data")));
        }
        return profiles;
    }
}
