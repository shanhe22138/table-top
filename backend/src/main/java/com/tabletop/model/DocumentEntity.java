package com.tabletop.model;

import java.time.Instant;
import java.util.Map;

public class DocumentEntity {
    private Long seq;
    private String collection;
    private String id;
    private String ownerId;
    private Map<String, Object> data;
    private Instant updatedAt;

    public Long getSeq() { return seq; }
    public void setSeq(Long seq) { this.seq = seq; }
    public String getCollection() { return collection; }
    public void setCollection(String collection) { this.collection = collection; }
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
