package com.tabletop.mapper;

import com.tabletop.model.DocumentEntity;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface DocumentMapper {
    DocumentEntity findById(@Param("collection") String collection, @Param("id") String id);
    List<DocumentEntity> findByCollection(String collection);
    List<DocumentEntity> findRecent(@Param("collection") String collection, @Param("limit") int limit);
    long count();
    int insert(DocumentEntity document);
    int update(DocumentEntity document);
    int delete(@Param("collection") String collection, @Param("id") String id);
}
