package com.meijietong.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "meijietong")
public record AppProperties(Ai ai, Feishu feishu) {
    public record Ai(String apiKey) {}
    public record Feishu(String appId, String appSecret, String tableUrl) {}

    public boolean aiConfigured() {
        return ai != null && ai.apiKey() != null && !ai.apiKey().isBlank() && !"disabled".equals(ai.apiKey());
    }

    public boolean feishuConfigured() {
        return feishu != null && feishu.appId() != null && !feishu.appId().isBlank()
                && feishu.appSecret() != null && !feishu.appSecret().isBlank();
    }

    public boolean feishuTargetConfigured() {
        return feishuConfigured() && feishu.tableUrl() != null && !feishu.tableUrl().isBlank();
    }
}
