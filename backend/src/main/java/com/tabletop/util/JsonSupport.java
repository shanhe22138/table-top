package com.tabletop.util;

import com.alibaba.fastjson2.JSON;
import java.util.LinkedHashMap;
import java.util.Map;

public final class JsonSupport {
    private JsonSupport() {}

    @SuppressWarnings("unchecked")
    public static Map<String, Object> object(Object value) {
        if (value == null) return new LinkedHashMap<>();
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return JSON.parseObject(JSON.toJSONString(value));
    }

    public static Map<String, Object> copy(Map<String, Object> value) {
        return JSON.parseObject(JSON.toJSONString(value));
    }

    public static String string(Map<String, Object> value, String key) {
        Object item = value.get(key);
        return item == null ? null : String.valueOf(item);
    }
}
