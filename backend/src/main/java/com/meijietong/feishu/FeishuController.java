package com.meijietong.feishu;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feishu")
public class FeishuController {
    private final FeishuService feishuService;

    public FeishuController(FeishuService feishuService) {
        this.feishuService = feishuService;
    }

    @GetMapping("/config")
    FeishuService.ConfigStatus config() {
        return feishuService.configStatus();
    }

    @PutMapping("/config")
    FeishuService.ConfigStatus configure(@RequestBody FeishuService.ConfigRequest request) {
        return feishuService.configure(request);
    }

    @PostMapping("/validate")
    FeishuService.ValidationResult validate(@RequestBody ValidateRequest request) {
        return feishuService.validate(request.tableUrl());
    }

    @PostMapping("/write")
    FeishuService.WriteResult write(@RequestBody FeishuService.WriteRequest request) throws Exception {
        return feishuService.write(request);
    }

    record ValidateRequest(String tableUrl) {}
}
