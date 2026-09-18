package com.meijietong.api;

import java.util.Map;

import com.meijietong.config.AppProperties;
import com.meijietong.feishu.FeishuService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StatusController {
    private final AppProperties properties;
    private final FeishuService feishuService;

    public StatusController(AppProperties properties, FeishuService feishuService) {
        this.properties = properties;
        this.feishuService = feishuService;
    }

    @GetMapping("/status")
    Map<String, Object> status() {
        return Map.of(
                "ready", true,
                "aiConfigured", properties.aiConfigured(),
                "feishuConfigured", feishuService.configStatus().configured(),
                "feishuTargetConfigured", properties.feishuTargetConfigured());
    }
}
