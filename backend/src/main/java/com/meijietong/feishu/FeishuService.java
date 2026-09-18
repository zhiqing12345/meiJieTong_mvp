package com.meijietong.feishu;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.meijietong.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class FeishuService {
    private static final String API_BASE = "https://open.feishu.cn";
    private static final LocalDate SHEET_DATE_ORIGIN = LocalDate.of(1899, 12, 30);
    private static final String DEFAULT_START_COLUMN = "N";
    private static final int OUTPUT_COLUMN_COUNT = 26;

    private final AppProperties properties;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().baseUrl(API_BASE).build();
    private volatile AccessToken accessToken;
    private volatile String appId;
    private volatile String appSecret;

    public FeishuService(AppProperties properties, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.properties = properties;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.appId = setting("feishu.app-id").orElse(properties.feishu() == null ? "" : properties.feishu().appId());
        this.appSecret = setting("feishu.app-secret").orElse(properties.feishu() == null ? "" : properties.feishu().appSecret());
    }

    public ConfigStatus configStatus() {
        return new ConfigStatus(configured(), maskAppId(appId));
    }

    public synchronized ConfigStatus configure(ConfigRequest request) {
        var nextAppId = request.appId() == null ? "" : request.appId().trim();
        var nextSecret = request.appSecret() == null || request.appSecret().isBlank() ? appSecret : request.appSecret().trim();
        if (nextAppId.isBlank()) throw new IllegalArgumentException("请填写飞书 App ID");
        if (!nextAppId.startsWith("cli_")) throw new IllegalArgumentException("App ID 格式不正确，应以 cli_ 开头");
        if (nextSecret == null || nextSecret.isBlank()) throw new IllegalArgumentException("请填写飞书 App Secret");

        AccessToken verified;
        try {
            verified = requestToken(nextAppId, nextSecret);
        } catch (RestClientResponseException exception) {
            throw new IllegalArgumentException(feishuError(exception, "App ID 或 App Secret 验证失败"));
        }
        saveSetting("feishu.app-id", nextAppId);
        saveSetting("feishu.app-secret", nextSecret);
        appId = nextAppId;
        appSecret = nextSecret;
        accessToken = verified;
        return configStatus();
    }

    public ValidationResult validate(String tableUrl) {
        requireConfigured();
        try {
            var target = resolveTarget(tableUrl);
            return new ValidationResult(true, target.spreadsheetToken(), target.sheetId(), target.sheetTitle(), "连接成功，可写入该工作表");
        } catch (RestClientResponseException exception) {
            throw new IllegalArgumentException(feishuError(exception, "无法访问该电子表格，请检查应用权限和文档授权"));
        }
    }

    public WriteResult write(WriteRequest request) throws Exception {
        requireConfigured();
        if (request.submissionKey() == null || request.submissionKey().isBlank()) {
            throw new IllegalArgumentException("缺少本地记录标识");
        }
        var previous = jdbcTemplate.query(
                "SELECT record_id FROM feishu_write WHERE submission_key = ? AND status = 'SUCCEEDED'",
                (result, row) -> result.getString("record_id"), request.submissionKey());
        if (!previous.isEmpty()) {
            return new WriteResult(true, previous.getFirst(), true, "该记录此前已成功写入飞书");
        }

        var target = resolveTarget(request.tableUrl());
        var startRow = request.startRow() == null ? 2 : request.startRow();
        if (startRow < 1) throw new IllegalArgumentException("数据起始行必须大于 0");
        var startColumn = normalizeColumn(request.startColumn());
        var endColumn = offsetColumn(startColumn, OUTPUT_COLUMN_COUNT - 1);
        var range = target.sheetId() + "!" + startColumn + startRow + ":" + endColumn + startRow;
        var values = rowValues(request.fields());
        var payload = objectMapper.writeValueAsString(Map.of("valueRange", Map.of("range", range, "values", List.of(values))));

        jdbcTemplate.update("""
                INSERT INTO feishu_write(submission_key, recognition_id, created_at, status, payload_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(submission_key) DO UPDATE SET
                  recognition_id = excluded.recognition_id,
                  created_at = excluded.created_at,
                  status = excluded.status,
                  payload_json = excluded.payload_json,
                  error_message = NULL
                """, request.submissionKey(), request.recognitionId(), Instant.now().toString(), "WRITING", payload);
        try {
            var response = restClient.post()
                    .uri("/open-apis/sheets/v2/spreadsheets/{spreadsheet}/values_append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", target.spreadsheetToken())
                    .header("Authorization", "Bearer " + token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve().body(JsonNode.class);
            assertSuccess(response, "写入飞书失败");
            var updatedRange = response.path("data").path("updates").path("updatedRange").asText();
            if (updatedRange.isBlank()) updatedRange = response.path("data").path("tableRange").asText();
            if (updatedRange.isBlank()) throw new IllegalStateException("飞书返回成功，但没有返回写入范围");
            jdbcTemplate.update("UPDATE feishu_write SET status = 'SUCCEEDED', record_id = ? WHERE submission_key = ?",
                    updatedRange, request.submissionKey());
            return new WriteResult(true, updatedRange, false, "成功写入飞书电子表格 " + updatedRange);
        } catch (Exception exception) {
            var message = exception instanceof RestClientResponseException responseException
                    ? feishuError(responseException, "写入飞书失败")
                    : Optional.ofNullable(exception.getMessage()).orElse("写入飞书失败");
            jdbcTemplate.update("UPDATE feishu_write SET status = 'FAILED', error_message = ? WHERE submission_key = ?",
                    message.substring(0, Math.min(message.length(), 1000)), request.submissionKey());
            throw new IllegalArgumentException(message, exception);
        }
    }

    private List<Object> rowValues(Map<String, Object> fields) {
        var values = new ArrayList<Object>();
        values.add(text(fields, "name"));
        values.add(text(fields, "role"));
        values.add(text(fields, "phone"));
        values.add(text(fields, "identity"));
        values.add("");
        values.add("");
        values.add("");
        values.add(text(fields, "outboundTransport"));
        values.add(sheetDate(fields, "outboundDate"));
        values.add(text(fields, "outboundRoute"));
        values.add(text(fields, "outboundTrain"));
        values.add(text(fields, "outboundStation"));
        values.add(text(fields, "outboundTime"));
        values.add(text(fields, "outboundArrival"));
        values.add("");
        values.add("");
        values.add(text(fields, "returnTransport"));
        values.add(sheetDate(fields, "returnDate"));
        values.add(text(fields, "returnRoute"));
        values.add(text(fields, "returnTrain"));
        values.add(text(fields, "returnStation"));
        values.add(text(fields, "returnTime"));
        values.add(text(fields, "returnArrival"));
        values.add("");
        values.add("");
        values.add(sheetDate(fields, "hotelDate"));
        return values;
    }

    private Object sheetDate(Map<String, Object> fields, String key) {
        var value = text(fields, key);
        if (value.isBlank()) return "";
        try {
            return ChronoUnit.DAYS.between(SHEET_DATE_ORIGIN, LocalDate.parse(value));
        } catch (Exception exception) {
            throw new IllegalArgumentException(key + " 必须是 yyyy-MM-dd 格式");
        }
    }

    private String text(Map<String, Object> fields, String key) {
        if (fields == null) return "";
        var value = fields.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Target resolveTarget(String requestedUrl) {
        var tableUrl = requestedUrl == null || requestedUrl.isBlank() ? properties.feishu().tableUrl() : requestedUrl;
        if (tableUrl == null || tableUrl.isBlank()) throw new IllegalArgumentException("尚未配置飞书表格链接");
        try {
            var uri = URI.create(tableUrl.trim());
            var parts = uri.getPath().split("/");
            String spreadsheetToken = null;
            String wikiToken = null;
            for (int index = 0; index < parts.length - 1; index++) {
                if ("sheets".equals(parts[index]) && !parts[index + 1].isBlank()) spreadsheetToken = parts[index + 1];
                if ("wiki".equals(parts[index]) && !parts[index + 1].isBlank()) wikiToken = parts[index + 1];
            }
            var sheetId = queryParam(uri.getRawQuery(), "sheet");
            if (spreadsheetToken == null && wikiToken != null) {
                var wikiNodeToken = wikiToken;
                var node = restClient.get()
                        .uri(builder -> builder.path("/open-apis/wiki/v2/spaces/get_node").queryParam("token", wikiNodeToken).build())
                        .header("Authorization", "Bearer " + token())
                        .retrieve().body(JsonNode.class);
                assertSuccess(node, "读取飞书知识库节点失败");
                var nodeType = node.path("data").path("node").path("obj_type").asText();
                if (!"sheet".equals(nodeType)) throw new IllegalArgumentException("该知识库链接不是电子表格，当前类型为 " + nodeType);
                spreadsheetToken = node.path("data").path("node").path("obj_token").asText();
            }
            if (spreadsheetToken == null || spreadsheetToken.isBlank()) {
                throw new IllegalArgumentException("链接需为飞书电子表格或指向电子表格的知识库链接");
            }
            return resolveSheet(spreadsheetToken, sheetId);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (RestClientResponseException exception) {
            throw new IllegalArgumentException(feishuError(exception, "无法访问飞书知识库或电子表格"));
        } catch (Exception exception) {
            throw new IllegalArgumentException("无法解析飞书电子表格链接：" + Optional.ofNullable(exception.getMessage()).orElse("未知错误"));
        }
    }

    private Target resolveSheet(String spreadsheetToken, String requestedSheetId) {
        var response = restClient.get()
                .uri("/open-apis/sheets/v3/spreadsheets/{spreadsheet}/sheets/query", spreadsheetToken)
                .header("Authorization", "Bearer " + token())
                .retrieve().body(JsonNode.class);
        assertSuccess(response, "读取飞书电子表格失败");
        JsonNode selected = null;
        for (var sheet : response.path("data").path("sheets")) {
            if (requestedSheetId == null || requestedSheetId.isBlank() || requestedSheetId.equals(sheet.path("sheet_id").asText())) {
                selected = sheet;
                break;
            }
        }
        if (selected == null) throw new IllegalArgumentException("链接中的工作表不存在，或应用无权访问");
        return new Target(spreadsheetToken, selected.path("sheet_id").asText(), selected.path("title").asText());
    }

    private String normalizeColumn(String column) {
        var value = column == null || column.isBlank() ? DEFAULT_START_COLUMN : column.trim().toUpperCase();
        if (!value.matches("[A-Z]{1,3}")) throw new IllegalArgumentException("起始列必须是列字母，例如 Q");
        return value;
    }

    private String offsetColumn(String column, int offset) {
        var number = 0;
        for (var character : column.toCharArray()) number = number * 26 + character - 'A' + 1;
        number += offset;
        var result = new StringBuilder();
        while (number > 0) {
            number--;
            result.append((char) ('A' + number % 26));
            number /= 26;
        }
        return result.reverse().toString();
    }

    private String queryParam(String query, String name) {
        if (query == null) return null;
        for (var part : query.split("&")) {
            var pair = part.split("=", 2);
            if (pair.length == 2 && name.equals(URLDecoder.decode(pair[0], StandardCharsets.UTF_8))) {
                return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private synchronized String token() {
        if (accessToken != null && accessToken.expiresAt().isAfter(Instant.now().plusSeconds(60))) return accessToken.value();
        accessToken = requestToken(appId, appSecret);
        return accessToken.value();
    }

    private AccessToken requestToken(String requestedAppId, String requestedSecret) {
        var response = restClient.post().uri("/open-apis/auth/v3/tenant_access_token/internal")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("app_id", requestedAppId, "app_secret", requestedSecret))
                .retrieve().body(JsonNode.class);
        assertSuccess(response, "获取飞书访问凭证失败");
        var value = response.path("tenant_access_token").asText();
        var expire = response.path("expire").asLong(7200);
        if (value.isBlank()) throw new IllegalStateException("飞书没有返回访问凭证");
        return new AccessToken(value, Instant.now().plusSeconds(expire));
    }

    private void requireConfigured() {
        if (!configured()) {
            throw new IllegalArgumentException("尚未配置飞书应用，请在活动右上角的飞书配置中填写 App ID 和 App Secret");
        }
    }

    private boolean configured() {
        return appId != null && !appId.isBlank() && appSecret != null && !appSecret.isBlank();
    }

    private Optional<String> setting(String key) {
        var values = jdbcTemplate.query("SELECT setting_value FROM app_setting WHERE setting_key = ?",
                (result, row) -> result.getString("setting_value"), key);
        return values.stream().findFirst();
    }

    private void saveSetting(String key, String value) {
        jdbcTemplate.update("""
                INSERT INTO app_setting(setting_key, setting_value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
                """, key, value, Instant.now().toString());
    }

    private String maskAppId(String value) {
        if (value == null || value.isBlank()) return "";
        if (value.length() <= 9) return value.substring(0, Math.min(4, value.length())) + "****";
        return value.substring(0, 8) + "****" + value.substring(value.length() - 4);
    }

    private void assertSuccess(JsonNode response, String fallback) {
        if (response == null) throw new IllegalStateException(fallback);
        if (response.path("code").asInt(-1) != 0) {
            var message = response.path("msg").asText(fallback);
            throw new IllegalArgumentException(fallback + "：" + message);
        }
    }

    private String feishuError(RestClientResponseException exception, String fallback) {
        try {
            var json = objectMapper.readTree(exception.getResponseBodyAsString());
            var message = json.path("msg").asText();
            return message.isBlank() ? fallback : fallback + "：" + message;
        } catch (Exception ignored) {
            return fallback + "（HTTP " + exception.getStatusCode().value() + "）";
        }
    }

    public record WriteRequest(String submissionKey, String recognitionId, String tableUrl,
                               Integer startRow, String startColumn, Map<String, Object> fields) {}
    public record WriteResult(boolean success, String recordId, boolean idempotent, String message) {}
    public record ValidationResult(boolean connected, String spreadsheetToken, String sheetId, String sheetTitle, String message) {}
    public record ConfigRequest(String appId, String appSecret) {}
    public record ConfigStatus(boolean configured, String appIdMasked) {}
    private record Target(String spreadsheetToken, String sheetId, String sheetTitle) {}
    private record AccessToken(String value, Instant expiresAt) {}
}
