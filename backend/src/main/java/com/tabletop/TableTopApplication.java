package com.tabletop;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
@MapperScan("com.tabletop.mapper")
public class TableTopApplication {
    public static void main(String[] args) {
        SpringApplication.run(TableTopApplication.class, args);
    }
}
