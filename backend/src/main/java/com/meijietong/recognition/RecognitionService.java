package com.meijietong.recognition;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.meijietong.config.AppProperties;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class RecognitionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(RecognitionService.class);
    private static final List<String> FIELD_NAMES = List.of(
            "name", "role", "phone", "identity",
            "outboundTransport", "outboundDate", "outboundRoute", "outboundTrain", "outboundStation", "outboundTime", "outboundArrival",
            "returnTransport", "returnDate", "returnRoute", "returnTrain", "returnStation", "returnTime", "returnArrival",
            "hotelDate", "notes");

    private static final String INSTRUCTIONS = """
            你是媒介活动资料整理助手。请从用户文字和图片中提取一位媒体参会者的信息，并严格返回指定结构。

            规则：
            1. 只能提取资料中明确出现的信息，绝不猜测身份证号、手机号、日期、车次、航班、航站楼或车站。
            2. 无法确认的字段返回空字符串。用户本轮未提供新值时，保留“已有字段”中的非空值。
            3. 去程日期、返程日期、住宿日期统一为 yyyy-MM-dd；只有月日且无法确定年份时留空，不得输出 Excel 日期序列号。
            4. 时间统一为 HH:mm。交通类型优先规范为“飞机”“高铁”“火车”“汽车”，资料无法判断时留空。
            5. 去程和返程必须按资料语义区分，不得为了填满字段而交换或复制。
            6. 同一字段出现冲突时，不覆盖已有字段，并在 notes 中简短说明冲突。
            7. outboundStation 表示去程的到达航站楼或高铁站；returnStation 表示返程的出发航站楼或高铁站。
            8. outboundRoute 和 returnRoute 按“出发地-抵达地”输出，例如“上海-武汉”。输出只包含结构字段，不附加解释。
            9. 火车票或购票 App 截图中，只以具体车次卡片为准：左侧时间下方是出发站，右侧时间下方是抵达站；页面顶部日期导航、搜索历史、城市筛选和推荐入口都不是行程字段。
            10. 图片未明确出现年份时，日期必须留空；不得根据“今天、明天、后天”、当前时间或常识推断年份。
            11. 一张图片只明确展示单程时，只填写对应的去程字段，返程字段全部留空；不得把顶部搜索条件或日期导航拼成返程。
            12. outboundStation 填具体的抵达站名。例如车次卡片左侧为“昆山南”、右侧为“上饶”，则 outboundRoute 为“昆山-上饶”，outboundStation 为“上饶”。
            """;

    private final ChatClient chatClient;
    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    public RecognitionService(ChatClient chatClient, AppProperties properties, ObjectMapper objectMapper, JdbcTemplate jdbcTemplate) {
        this.chatClient = chatClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
    }

    public RecognitionResult recognize(String text, String existingFieldsJson, List<MultipartFile> files) throws IOException {
        if (!properties.aiConfigured()) {
            throw new IllegalArgumentException("尚未配置模型密钥，请设置 MEIJIETONG_AI_API_KEY 后重启后端");
        }
        var supportedFiles = files.stream().filter(this::isSupportedImage).toList();
        if ((text == null || text.isBlank()) && supportedFiles.isEmpty()) {
            throw new IllegalArgumentException("请至少提供文字或一张图片");
        }
        var id = UUID.randomUUID().toString();
        jdbcTemplate.update("INSERT INTO recognition_job(id, created_at, status, input_text) VALUES (?, ?, ?, ?)",
                id, Instant.now().toString(), "PROCESSING", text);
        try {
            var existing = parseExisting(existingFieldsJson);
            var prompt = "已有字段：\n" + objectMapper.writeValueAsString(existing)
                    + "\n\n本轮用户文字：\n" + (text == null || text.isBlank() ? "（无）" : text);

            var request = chatClient.prompt().system(INSTRUCTIONS).user(user -> {
                user.text(prompt);
                for (var file : supportedFiles) {
                    var contentType = file.getContentType();
                    try {
                        var bytes = file.getBytes();
                        user.media(MimeTypeUtils.parseMimeType(contentType), new NamedByteArrayResource(bytes, file.getOriginalFilename()));
                    } catch (IOException exception) {
                        throw new IllegalArgumentException("读取图片失败：" + file.getOriginalFilename(), exception);
                    }
                }
            });

            var extracted = request.call().entity(RecognitionFields.class, spec -> spec.validateSchema());
            if (extracted == null) {
                throw new IllegalStateException("模型没有返回可用的结构化结果");
            }
            var merged = merge(existing, extracted);
            var json = objectMapper.writeValueAsString(merged);
            jdbcTemplate.update("UPDATE recognition_job SET status = ?, result_json = ? WHERE id = ?", "SUCCEEDED", json, id);
            return new RecognitionResult(id, "SUCCEEDED", merged, buildMessage(merged));
        } catch (Exception exception) {
            LOGGER.warn("Recognition request failed", exception);
            jdbcTemplate.update("UPDATE recognition_job SET status = ?, error_message = ? WHERE id = ?",
                    "FAILED", safeMessage(exception), id);
            throw exception;
        }
    }

    private boolean isSupportedImage(MultipartFile file) {
        var contentType = file.getContentType();
        return contentType != null && contentType.startsWith("image/") && !"image/svg+xml".equals(contentType);
    }

    private Map<String, String> parseExisting(String json) throws JacksonException {
        if (json == null || json.isBlank()) return Map.of();
        var raw = objectMapper.readValue(json, Map.class);
        var result = new LinkedHashMap<String, String>();
        for (var name : FIELD_NAMES) {
            var value = raw.get(name);
            result.put(name, value == null ? "" : String.valueOf(value));
        }
        return result;
    }

    private RecognitionFields merge(Map<String, String> existing, RecognitionFields value) {
        return new RecognitionFields(
                choose(value.name(), existing.get("name")), choose(value.role(), existing.get("role")),
                choose(value.phone(), existing.get("phone")), choose(value.identity(), existing.get("identity")),
                normalizeTransport(value.outboundTransport(), value.outboundTrain(), existing.get("outboundTransport"), existing.get("outboundTrain")), chooseDate(value.outboundDate(), existing.get("outboundDate")),
                choose(value.outboundRoute(), existing.get("outboundRoute")),
                choose(value.outboundTrain(), existing.get("outboundTrain")), choose(value.outboundStation(), existing.get("outboundStation")),
                choose(value.outboundTime(), existing.get("outboundTime")), choose(value.outboundArrival(), existing.get("outboundArrival")),
                normalizeTransport(value.returnTransport(), value.returnTrain(), existing.get("returnTransport"), existing.get("returnTrain")), chooseDate(value.returnDate(), existing.get("returnDate")),
                choose(value.returnRoute(), existing.get("returnRoute")),
                choose(value.returnTrain(), existing.get("returnTrain")), choose(value.returnStation(), existing.get("returnStation")),
                choose(value.returnTime(), existing.get("returnTime")), choose(value.returnArrival(), existing.get("returnArrival")),
                chooseDate(value.hotelDate(), existing.get("hotelDate")),
                choose(value.notes(), existing.get("notes")));
    }

    private String normalizeTransport(String candidate, String trainCandidate, String existingTransport, String existingTrain) {
        var number = choose(trainCandidate, existingTrain).toUpperCase().replaceAll("[\\s次-]", "");
        if (number.matches("^[GCD]\\d{1,5}$")) return "高铁";
        if (number.matches("^[ZTKYLS]\\d{1,5}$") || number.matches("^\\d{4,5}$")) return "火车";
        if (number.matches("^[A-Z0-9]{2}\\d{3,4}$")) return "飞机";

        var transport = choose(candidate, existingTransport);
        if (transport.contains("飞机") || transport.contains("航班")) return "飞机";
        if (transport.contains("高铁") || transport.contains("动车")) return "高铁";
        if (transport.contains("火车") || transport.contains("列车")) return "火车";
        if (transport.contains("汽车") || transport.contains("大巴")) return "汽车";
        return transport;
    }

    private String chooseDate(String candidate, String existing) {
        var value = choose(candidate, existing);
        return value.matches("\\d{4}-\\d{2}-\\d{2}") ? value : "";
    }

    private String choose(String candidate, String existing) {
        return candidate == null || candidate.isBlank() ? (existing == null ? "" : existing) : candidate.trim();
    }

    private String buildMessage(RecognitionFields fields) {
        var missing = new ArrayList<String>();
        if (fields.name().isBlank()) missing.add("出席人");
        if (fields.phone().isBlank()) missing.add("联系方式");
        return missing.isEmpty() ? "资料已识别，请逐项核对并完成确认。" : "识别完成，仍需补充：" + String.join("、", missing) + "。";
    }

    private String safeMessage(Exception exception) {
        var messages = new ArrayList<String>();
        Throwable current = exception;
        while (current != null && messages.size() < 5) {
            var message = current.getMessage();
            messages.add(current.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message));
            current = current.getCause();
        }
        var detail = String.join(" -> ", messages);
        return detail.substring(0, Math.min(detail.length(), 1000));
    }

    public record RecognitionResult(String id, String status, RecognitionFields fields, String message) {}

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(byte[] byteArray, String filename) {
            super(byteArray);
            this.filename = filename == null ? "image" : filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
