package com.tabletop.service;

import com.tabletop.exception.ApiException;
import com.tabletop.mapper.UserMapper;
import com.tabletop.model.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.bouncycastle.crypto.generators.SCrypt;
import org.bouncycastle.util.encoders.Hex;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final int SCRYPT_N = 16_384;
    private static final int SCRYPT_R = 8;
    private static final int SCRYPT_P = 1;
    private static final int SCRYPT_KEY_LENGTH = 64;

    private final UserMapper userMapper;
    private final TokenService tokenService;
    private final SettingsService settingsService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserMapper userMapper, TokenService tokenService, SettingsService settingsService) {
        this.userMapper = userMapper;
        this.tokenService = tokenService;
        this.settingsService = settingsService;
    }

    @Transactional
    @CacheEvict(value = "state", allEntries = true)
    public Map<String, Object> register(Map<String, Object> body) {
        String username = text(body.get("username")).trim().toLowerCase();
        String nickname = text(body.get("nickname")).trim();
        String password = text(body.get("password"));
        String email = text(body.get("email")).trim();
        if (!username.matches("^[\\w\\u4e00-\\u9fa5]{2,16}$")) {
            throw ApiException.badRequest("登录名需要 2–16 位，可以用中英文、数字、下划线");
        }
        if (password.length() < 6) throw ApiException.badRequest("密码至少 6 位");
        if (nickname.length() < 2 || nickname.length() > 12) throw ApiException.badRequest("昵称需要 2–12 个字符");
        if (userMapper.findByUsername(username) != null) throw ApiException.conflict("这个登录名已经被用了");
        if (userMapper.findAll().stream().anyMatch(u -> u.getNickname().equals(nickname))) {
            throw ApiException.conflict("这个昵称被占用了，换一个吧");
        }

        boolean first = userMapper.count() == 0;
        settingsService.ensureDefaults();
        Instant now = Instant.now();
        UserEntity user = new UserEntity();
        user.setId("u_" + randomHex(8));
        user.setUsername(username);
        user.setEmail(email.isEmpty() ? null : email);
        user.setNickname(nickname);
        user.setPasswordHash("bcrypt:" + passwordEncoder.encode(password));
        user.setRole(first ? "owner" : "user");
        user.setUid("U" + randomHex(4).toUpperCase());
        user.setProfile(defaultProfile());
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userMapper.insert(user);
        if (first) settingsService.assignInitialOwner(user.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", tokenService.sign(user.getId()));
        result.put("session", session(user));
        return result;
    }

    public Map<String, Object> login(Map<String, Object> body) {
        String username = text(body.get("username")).trim().toLowerCase();
        String password = text(body.get("password"));
        UserEntity user = userMapper.findByUsername(username);
        if (user == null || !matches(password, user)) {
            throw ApiException.unauthorized("登录名或密码不对");
        }
        if (user.getPasswordHash().startsWith("scrypt:")) {
            userMapper.updatePassword(user.getId(), "bcrypt:" + passwordEncoder.encode(password), Instant.now());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", tokenService.sign(user.getId()));
        result.put("session", session(user));
        return result;
    }

    public Map<String, Object> session(HttpServletRequest request) {
        UserEntity user = currentUser(request);
        return Map.of("session", user == null ? Map.of() : session(user));
    }

    public Map<String, Object> sessionOrNull(HttpServletRequest request) {
        UserEntity user = currentUser(request);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("session", user == null ? null : session(user));
        return result;
    }

    public UserEntity currentUser(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String userId = tokenService.read(authorization.substring(7));
        return userId == null ? null : userMapper.findById(userId);
    }

    public UserEntity requireUser(HttpServletRequest request) {
        UserEntity user = currentUser(request);
        if (user == null) throw ApiException.unauthorized("登录已过期，请重新登录");
        return user;
    }

    public static boolean isAdmin(UserEntity user) {
        return user != null && ("admin".equals(user.getRole()) || "owner".equals(user.getRole()));
    }

    public static Map<String, Object> defaultProfile() {
        Map<String, Object> prefs = new LinkedHashMap<>();
        prefs.put("plays", new ArrayList<>());
        prefs.put("locations", new ArrayList<>());
        prefs.put("durationRange", null);
        prefs.put("maxDifficulty", new LinkedHashMap<>());
        prefs.put("tags", new LinkedHashMap<>());
        prefs.put("boards", new ArrayList<>());

        Map<String, Object> host = new LinkedHashMap<>();
        host.put("enabled", false);
        host.put("types", new ArrayList<>());
        host.put("intro", "");
        host.put("venues", new ArrayList<>());
        host.put("contact", "");

        Map<String, Object> privacy = new LinkedHashMap<>();
        for (String key : List.of("bio", "prefs", "showcase", "events", "favRoles", "host", "followers")) {
            privacy.put(key, true);
        }

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("avatar", null);
        profile.put("bio", "");
        profile.put("prefs", prefs);
        profile.put("favRoles", new ArrayList<>());
        profile.put("host", host);
        profile.put("privacy", privacy);
        profile.put("showUsername", true);
        profile.put("following", new ArrayList<>());
        profile.put("followers", new ArrayList<>());
        profile.put("likedUsers", new ArrayList<>());
        return profile;
    }

    private boolean matches(String password, UserEntity user) {
        String stored = user.getPasswordHash();
        if (stored.startsWith("bcrypt:")) return passwordEncoder.matches(password, stored.substring(7));
        if (!stored.startsWith("scrypt:") || user.getPasswordSalt() == null) return false;
        try {
            byte[] actual = SCrypt.generate(password.getBytes(StandardCharsets.UTF_8),
                    Hex.decode(user.getPasswordSalt()), SCRYPT_N, SCRYPT_R, SCRYPT_P, SCRYPT_KEY_LENGTH);
            return MessageDigest.isEqual(actual, Hex.decode(stored.substring(7)));
        } catch (RuntimeException error) {
            return false;
        }
    }

    private Map<String, Object> session(UserEntity user) {
        Map<String, Object> session = new LinkedHashMap<>();
        session.put("userId", user.getId());
        session.put("username", user.getUsername());
        session.put("nickname", user.getNickname());
        return session;
    }

    private String randomHex(int bytes) {
        byte[] value = new byte[bytes];
        random.nextBytes(value);
        return HexFormat.of().formatHex(value);
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
