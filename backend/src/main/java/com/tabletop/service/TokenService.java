package com.tabletop.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.tabletop.mapper.MetaMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TokenService {
    private static final long TOKEN_TTL_SECONDS = 30L * 24 * 60 * 60;
    private final MetaMapper metaMapper;
    private final String configuredSecret;
    private final SecureRandom random = new SecureRandom();
    private volatile String secret;

    public TokenService(MetaMapper metaMapper, @Value("${table-top.auth-secret:}") String configuredSecret) {
        this.metaMapper = metaMapper;
        this.configuredSecret = configuredSecret == null ? "" : configuredSecret.trim();
    }

    public String sign(String userId) {
        JSONObject payload = new JSONObject();
        payload.put("u", userId);
        payload.put("exp", Instant.now().plusSeconds(TOKEN_TTL_SECONDS).toEpochMilli());
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(
                JSON.toJSONString(payload).getBytes(StandardCharsets.UTF_8));
        return encoded + "." + hmac(encoded);
    }

    public String read(String token) {
        try {
            if (token == null) return null;
            String[] parts = token.split("\\.", -1);
            if (parts.length != 2) return null;
            byte[] actual = Base64.getUrlDecoder().decode(parts[1]);
            byte[] expected = Base64.getUrlDecoder().decode(hmac(parts[0]));
            if (!MessageDigest.isEqual(actual, expected)) return null;
            JSONObject payload = JSON.parseObject(new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8));
            if (payload.getLongValue("exp") < System.currentTimeMillis()) return null;
            return payload.getString("u");
        } catch (RuntimeException error) {
            return null;
        }
    }

    private String hmac(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("无法生成认证令牌", error);
        }
    }

    private String secret() {
        if (!configuredSecret.isEmpty()) return configuredSecret;
        String current = secret;
        if (current != null) return current;
        synchronized (this) {
            if (secret == null) {
                String stored = metaMapper.find("auth_secret");
                if (stored == null || stored.isBlank()) {
                    byte[] bytes = new byte[32];
                    random.nextBytes(bytes);
                    stored = java.util.HexFormat.of().formatHex(bytes);
                    metaMapper.upsert("auth_secret", stored);
                }
                secret = stored;
            }
            return secret;
        }
    }
}
