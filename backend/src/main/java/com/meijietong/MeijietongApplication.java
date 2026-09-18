package com.meijietong;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MeijietongApplication {

    public static void main(String[] args) throws Exception {
        var configured = System.getenv("MEIJIETONG_DATA_DIR");
        var dataDir = configured == null || configured.isBlank()
                ? Path.of(System.getProperty("user.home"), ".meijietong")
                : Path.of(configured);
        Files.createDirectories(dataDir);
        System.setProperty("meijietong.data-dir", dataDir.toAbsolutePath().toString().replace('\\', '/'));
        SpringApplication.run(MeijietongApplication.class, args);
    }
}
