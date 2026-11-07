package com.tabletop.service;

import com.tabletop.exception.ApiException;
import com.tabletop.mapper.DocumentMapper;
import com.tabletop.model.DocumentEntity;
import com.tabletop.model.UserEntity;
import com.tabletop.util.JsonSupport;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class FeedbackService {
    private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);
    private final DocumentMapper documentMapper;
    private final TransactionTemplate transactionTemplate;

    public FeedbackService(DocumentMapper documentMapper, TransactionTemplate transactionTemplate) {
        this.documentMapper = documentMapper;
        this.transactionTemplate = transactionTemplate;
    }

    @CacheEvict(value = "state", allEntries = true)
    public Map<String, Object> submit(UserEntity user, Map<String, Object> body) {
        String content = text(body.get("content")).trim();
        String subject = text(body.get("subject")).trim();
        String fromName = text(body.get("fromName")).trim();
        String email = text(body.get("email")).trim();
        if (content.isEmpty()) throw ApiException.badRequest("反馈内容不能为空");
        if (subject.isEmpty()) subject = "反馈";
        if (fromName.isEmpty()) fromName = user == null ? "匿名" : user.getNickname();

        Instant now = Instant.now();
        Map<String, Object> feedback = new LinkedHashMap<>();
        feedback.put("id", "fb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        feedback.put("fromUserId", user == null ? null : user.getId());
        feedback.put("fromName", fromName);
        feedback.put("email", email.isEmpty() ? null : email);
        feedback.put("subject", subject);
        feedback.put("content", content);
        feedback.put("createdAt", now.toString());
        transactionTemplate.executeWithoutResult(status -> {
            DocumentEntity document = new DocumentEntity();
            document.setCollection("feedbacks");
            document.setId(JsonSupport.string(feedback, "id"));
            document.setData(feedback);
            document.setUpdatedAt(now);
            documentMapper.insert(document);
        });

        boolean emailed = false;
        String emailError = null;
        try {
            emailed = sendIfConfigured(feedback);
        } catch (Exception error) {
            emailError = error.getMessage();
            log.warn("反馈已保存，但邮件发送失败：{}", emailError);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("stored", true);
        result.put("emailed", emailed);
        result.put("emailError", emailError);
        return result;
    }

    private boolean sendIfConfigured(Map<String, Object> feedback) {
        DocumentEntity settingsDocument = documentMapper.findById("settings", "app");
        if (settingsDocument == null) return false;
        Map<String, Object> settings = settingsDocument.getData();
        String to = text(settings.get("feedbackEmail")).trim();
        Object rawSmtp = settings.get("smtp");
        if (to.isEmpty() || !(rawSmtp instanceof Map<?, ?>)) return false;
        Map<String, Object> smtp = JsonSupport.object(rawSmtp);
        String host = text(smtp.get("host")).trim();
        if (host.isEmpty()) return false;
        int port = Integer.parseInt(text(smtp.get("port")));
        String username = text(smtp.get("user"));
        String password = text(smtp.get("pass"));
        String from = text(smtp.get("from")).trim();
        if (from.isEmpty()) from = to;

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        sender.setDefaultEncoding("UTF-8");
        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", !username.isEmpty());
        properties.put("mail.smtp.connectiontimeout", "5000");
        properties.put("mail.smtp.timeout", "5000");
        properties.put("mail.smtp.writetimeout", "5000");
        if (port == 465) properties.put("mail.smtp.ssl.enable", "true");
        else properties.put("mail.smtp.starttls.enable", "true");

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject("[开局反馈] " + feedback.get("subject"));
        message.setText("来自：" + feedback.get("fromName")
                + (feedback.get("email") == null ? "" : " <" + feedback.get("email") + ">")
                + "\n时间：" + feedback.get("createdAt") + "\n\n" + feedback.get("content"));
        sender.send(message);
        return true;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
