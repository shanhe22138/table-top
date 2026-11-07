package com.tabletop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class ApiIntegrationTest {
    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

    @Autowired
    MockMvc mvc;

    @Test
    void supportsExistingApiAndPermissions() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));

        JSONObject ownerAuth = register("owner", "站长", "pass123456");
        JSONObject userAuth = register("player", "玩家甲", "pass123456");
        String ownerToken = ownerAuth.getString("token");
        String userToken = userAuth.getString("token");
        String ownerId = ownerAuth.getJSONObject("session").getString("userId");
        String userId = userAuth.getJSONObject("session").getString("userId");

        mvc.perform(get("/api/auth/session").header("Authorization", bearer(userToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.session.username").value("player"));
        mvc.perform(post("/api/sync").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());

        JSONObject userState = state(userToken);
        assertThat(userState.getJSONArray("logs")).isEmpty();
        assertThat(userState.getJSONArray("feedbacks")).isEmpty();
        assertThat(userState.getJSONArray("settings").getJSONObject(0).getString("feedbackEmail")).isEmpty();
        assertThat(userState.getJSONArray("users").getJSONObject(0).getString("passwordHash")).isEmpty();

        sync(userToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "games",
                "row", Map.of("id", "g_hack", "title", "越权条目")))), 403);
        sync(userToken, Map.of("ops", List.of(Map.of("t", "update", "table", "users", "id", userId,
                "patch", Map.of("role", "admin")))), 403);

        sync(ownerToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "games", "row",
                Map.of("id", "g1", "title", "年轮", "kind", "script", "tags", List.of())))), 200);
        assertThat(state(userToken).getJSONArray("games")).hasSize(1);

        Map<String, Object> openSeat = new JSONObject().fluentPut("id", "st1")
                .fluentPut("userId", null).fluentPut("status", "open");
        sync(userToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "events", "row",
                new JSONObject().fluentPut("id", "e1").fluentPut("title", "测试局")
                        .fluentPut("seats", List.of(openSeat)).fluentPut("hostId", "forged")))), 200);
        Map<String, Object> joinedSeat = Map.of("id", "st1", "userId", ownerId, "status", "filled");
        sync(ownerToken, Map.of("ops", List.of(Map.of("t", "update", "table", "events", "id", "e1",
                "patch", Map.of("seats", List.of(joinedSeat))))), 200);
        JSONObject event = state(userToken).getJSONArray("events").getJSONObject(0);
        assertThat(event.getString("hostId")).isEqualTo(userId);
        assertThat(event.getJSONArray("seats").getJSONObject(0).getString("userId")).isEqualTo(ownerId);

        sync(userToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "posts", "row",
                new JSONObject().fluentPut("id", "p1").fluentPut("text", "第一条动态")
                        .fluentPut("authorId", "forged").fluentPut("likes", List.of()).fluentPut("comments", List.of())))), 200);
        Map<String, Object> comment = new JSONObject().fluentPut("id", "pc1").fluentPut("authorId", ownerId)
                .fluentPut("authorName", "forged").fluentPut("authorUid", "forged").fluentPut("text", "收到");
        sync(ownerToken, Map.of("ops", List.of(Map.of("t", "update", "table", "posts", "id", "p1",
                "patch", Map.of("likes", List.of(ownerId), "comments", List.of(comment))))), 200);
        JSONObject post = state(userToken).getJSONArray("posts").getJSONObject(0);
        assertThat(post.getString("authorId")).isEqualTo(userId);
        assertThat(post.getJSONArray("comments").getJSONObject(0).getString("authorName")).isEqualTo("站长");

        sync(userToken, Map.of("ops", List.of(
                Map.of("t", "insert", "table", "reviews", "row", Map.of("id", "r1", "gameId", "g1")),
                Map.of("t", "insert", "table", "games", "row", Map.of("id", "g2", "title", "不应落库")))), 403);
        assertThat(state(userToken).getJSONArray("reviews")).isEmpty();

        sync(ownerToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "logs", "row",
                Map.of("id", "log1", "userId", "forged", "userName", "伪造", "action", "测试")))), 200);
        JSONObject log = state(ownerToken).getJSONArray("logs").getJSONObject(0);
        assertThat(log.getString("userId")).isEqualTo(ownerId);
        assertThat(log.getString("userName")).isEqualTo("站长");

        mvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.toJSONString(Map.of("subject", "建议", "content", "保留这条反馈"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stored").value(true));
        assertThat(state(ownerToken).getJSONArray("feedbacks")).hasSize(1);

        sync(ownerToken, Map.of("ops", List.of(Map.of("t", "update", "table", "users", "id", userId,
                "patch", Map.of("role", "admin")))), 200);
        sync(userToken, Map.of("ops", List.of(Map.of("t", "insert", "table", "games", "row",
                Map.of("id", "g3", "title", "管理员条目")))), 200);

        sync(ownerToken, Map.of("ops", List.of(
                Map.of("t", "update", "table", "users", "id", ownerId, "patch", Map.of("role", "admin")),
                Map.of("t", "update", "table", "users", "id", userId, "patch", Map.of("role", "owner")),
                Map.of("t", "update", "table", "settings", "id", "app", "patch", Map.of("ownerId", userId)))), 200);
        JSONObject users = state(ownerToken);
        assertThat(findById(users.getJSONArray("users"), ownerId).getString("role")).isEqualTo("admin");
        assertThat(findById(users.getJSONArray("users"), userId).getString("role")).isEqualTo("owner");
        assertThat(users.getJSONArray("settings").getJSONObject(0).getString("ownerId")).isEqualTo(userId);
    }

    private JSONObject register(String username, String nickname, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(JSON.toJSONString(Map.of("username", username, "nickname", nickname, "password", password))))
                .andExpect(status().isOk()).andReturn();
        return JSON.parseObject(result.getResponse().getContentAsString());
    }

    private JSONObject state(String token) throws Exception {
        MvcResult result = mvc.perform(get("/api/state").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn();
        return JSON.parseObject(result.getResponse().getContentAsString());
    }

    private void sync(String token, Map<String, Object> body, int expectedStatus) throws Exception {
        mvc.perform(post("/api/sync").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(JSON.toJSONString(body)))
                .andExpect(status().is(expectedStatus));
    }

    private JSONObject findById(JSONArray rows, String id) {
        return rows.stream().map(JSONObject.class::cast).filter(row -> id.equals(row.getString("id"))).findFirst().orElseThrow();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
