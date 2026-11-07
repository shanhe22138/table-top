package com.tabletop.mapper;

import org.apache.ibatis.annotations.Param;

public interface MetaMapper {
    String find(@Param("key") String key);
    int upsert(@Param("key") String key, @Param("value") String value);
}
