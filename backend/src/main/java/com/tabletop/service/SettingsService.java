package com.tabletop.service;

import com.tabletop.mapper.DocumentMapper;
import com.tabletop.mapper.UserMapper;
import com.tabletop.model.DocumentEntity;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {
    private final DocumentMapper documentMapper;
    private final UserMapper userMapper;

    public SettingsService(DocumentMapper documentMapper, UserMapper userMapper) {
        this.documentMapper = documentMapper;
        this.userMapper = userMapper;
    }

    @Transactional
    public void ensureDefaults() {
        if (documentMapper.findById("settings", "app") != null) return;
        String ownerId = userMapper.findAll().stream().filter(u -> "owner".equals(u.getRole()))
                .map(u -> u.getId()).findFirst().orElse(null);
        Map<String, Object> settings = defaults(ownerId);
        DocumentEntity document = new DocumentEntity();
        document.setCollection("settings");
        document.setId("app");
        document.setData(settings);
        document.setUpdatedAt(Instant.now());
        documentMapper.insert(document);
    }

    @Transactional
    public void assignInitialOwner(String userId) {
        DocumentEntity document = documentMapper.findById("settings", "app");
        if (document == null) return;
        if (document.getData().get("ownerId") == null) {
            document.getData().put("ownerId", userId);
            document.setUpdatedAt(Instant.now());
            documentMapper.update(document);
        }
    }

    public static Map<String, Object> defaults(String ownerId) {
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("id", "app");
        settings.put("locations", new ArrayList<>(List.of("浦东", "青浦", "杭州")));
        Map<String, Object> taxonomy = new LinkedHashMap<>();
        taxonomy.put("script", List.of("硬核推理", "还原", "情感", "恐怖", "欢乐", "机制", "阵营", "沉浸", "本格", "变格", "社会派", "现代", "古风", "民国", "日式", "欧式", "校园", "科幻", "架空"));
        taxonomy.put("board", List.of("策略", "德式", "美式", "家庭", "聚会", "卡牌", "骰子", "抽象", "战棋", "儿童", "工人放置", "区域控制", "手牌管理", "牌库构筑", "卡牌轮抽", "骰子驱动", "板块放置", "成套收集", "隐藏身份", "社交推理", "资源管理", "引擎构筑", "竞拍", "合作", "可变玩家能力", "奇幻", "科幻", "历史", "恐怖", "经济", "文明", "探险", "自然"));
        taxonomy.put("trpg", List.of("DND 5e", "COC 7th", "克苏鲁", "轻规则", "房规", "其他", "调查", "战斗", "叙事", "恐怖", "喜剧", "长团", "短团"));
        taxonomy.put("soup", List.of("本格", "变格", "恐怖", "温情", "脑洞", "逻辑"));
        taxonomy.put("social", List.of("狼人杀", "阿瓦隆", "血染钟楼", "一夜狼", "其他", "竞技", "娱乐", "新手局", "高手局"));
        taxonomy.put("tcg", List.of("游戏王", "万智牌", "宝可梦", "数码宝贝", "其他", "标准", "扩展", "限制", "娱乐"));
        settings.put("taxonomy", taxonomy);
        settings.put("ownerId", ownerId);
        settings.put("feedbackEmail", "");
        settings.put("smtp", null);
        settings.put("updatedAt", Instant.now().toString());
        return settings;
    }
}
