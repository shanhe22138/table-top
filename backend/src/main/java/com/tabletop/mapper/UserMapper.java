package com.tabletop.mapper;

import com.tabletop.model.UserEntity;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    UserEntity findById(String id);
    UserEntity findByUsername(String username);
    List<UserEntity> findAll();
    long count();
    int insert(UserEntity user);
    int updateProfile(UserEntity user);
    int updatePassword(@Param("id") String id, @Param("passwordHash") String passwordHash,
            @Param("updatedAt") Instant updatedAt);
    int updateRole(@Param("id") String id, @Param("role") String role, @Param("updatedAt") Instant updatedAt);
}
