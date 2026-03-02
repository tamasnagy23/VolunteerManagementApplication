package com.example.volunteermanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class VolunteermanagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(VolunteermanagementApplication.class, args);
    }

}
