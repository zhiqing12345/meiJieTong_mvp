package com.meijietong.recognition;

import java.io.IOException;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/recognitions")
public class RecognitionController {
    private final RecognitionService recognitionService;

    public RecognitionController(RecognitionService recognitionService) {
        this.recognitionService = recognitionService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    RecognitionService.RecognitionResult recognize(
            @RequestParam(defaultValue = "") String text,
            @RequestParam(defaultValue = "{}") String existingFields,
            @RequestParam(required = false) List<MultipartFile> files) throws IOException {
        return recognitionService.recognize(text, existingFields, files == null ? List.of() : files);
    }
}
