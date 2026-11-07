package com.tabletop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.tabletop.mapper.UserMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.bouncycastle.crypto.generators.SCrypt;
import org.bouncycastle.util.encoders.Hex;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class LegacyMigrationIntegrationTest {
    private static final Path SQLITE = Path.of(System.getProperty("java.io.tmpdir"),
            "table-top-legacy-" + UUID.randomUUID() + ".db");

    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

    @Autowired
    MockMvc mvc;

    @Autowired
    UserMapper userMapper;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("table-top.sqlite-import", SQLITE::toString);
    }

    @BeforeAll
    static void createLegacyDatabase() throws Exception {
        String salt = "00112233445566778899aabbccddeeff";
        String hash = Hex.toHexString(SCrypt.generate("pass123456".getBytes(StandardCharsets.UTF_8),
                Hex.decode(salt), 16_384, 8, 1, 64));
        try (Connection db = DriverManager.getConnection("jdbc:sqlite:" + SQLITE); Statement statement = db.createStatement()) {
            statement.execute("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT, nickname TEXT NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL)");
            statement.execute("CREATE TABLE docs (collection TEXT NOT NULL, id TEXT NOT NULL, owner_id TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (collection, id))");
            statement.execute("CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)");
            try (PreparedStatement insert = db.prepareStatement("INSERT INTO users VALUES (?, ?, NULL, ?, ?, ?, ?)")) {
                insert.setString(1, "u_legacy");
                insert.setString(2, "legacy");
                insert.setString(3, "旧用户");
                insert.setString(4, hash);
                insert.setString(5, salt);
                insert.setString(6, Instant.now().toString());
                insert.executeUpdate();
            }
            try (PreparedStatement insert = db.prepareStatement("INSERT INTO docs VALUES (?, ?, ?, ?, ?)")) {
                insert.setString(1, "users");
                insert.setString(2, "u_legacy");
                insert.setString(3, "u_legacy");
                insert.setString(4, JSON.toJSONString(Map.of("bio", "迁移资料")));
                insert.setString(5, Instant.now().toString());
                insert.executeUpdate();
                insert.setString(1, "games");
                insert.setString(2, "g_legacy");
                insert.setString(3, null);
                insert.setString(4, JSON.toJSONString(Map.of("id", "g_legacy", "title", "旧条目")));
                insert.executeUpdate();
            }
        }
    }

    @Test
    void importsEarlySchemaAndUpgradesPasswordAfterLogin() throws Exception {
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.toJSONString(Map.of("username", "legacy", "password", "pass123456"))))
                .andExpect(status().isOk()).andReturn();
        String token = JSON.parseObject(login.getResponse().getContentAsString()).getString("token");
        MvcResult stateResult = mvc.perform(get("/api/state").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        JSONObject state = JSON.parseObject(stateResult.getResponse().getContentAsString());
        assertThat(state.getJSONArray("users")).hasSize(1);
        JSONObject user = state.getJSONArray("users").getJSONObject(0);
        assertThat(user.getString("role")).isEqualTo("owner");
        assertThat(user.getString("uid")).startsWith("U");
        assertThat(user.getString("bio")).isEqualTo("迁移资料");
        assertThat(state.getJSONArray("games")).hasSize(1);
        assertThat(state.getJSONArray("settings").getJSONObject(0).getString("ownerId")).isEqualTo("u_legacy");
        assertThat(userMapper.findById("u_legacy").getPasswordHash()).startsWith("bcrypt:");
        Files.deleteIfExists(SQLITE);
    }
}
