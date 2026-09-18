CREATE TABLE IF NOT EXISTS recognition_job (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    input_text TEXT,
    result_json TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS feishu_write (
    submission_key TEXT PRIMARY KEY,
    recognition_id TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    record_id TEXT,
    payload_json TEXT NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_recognition_created_at ON recognition_job(created_at);

CREATE TABLE IF NOT EXISTS app_setting (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
