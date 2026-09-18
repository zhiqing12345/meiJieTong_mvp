const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(body?.message || `请求失败（${response.status}）`);
  return body;
}

async function fileBlob(file) {
  if (!file?.url) throw new Error(`无法读取图片：${file?.name || '未知文件'}`);
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`无法读取图片：${file.name}`);
  return response.blob();
}

export async function recognizeMedia({ text, files, existingFields }) {
  const form = new FormData();
  form.append('text', text || '');
  form.append('existingFields', JSON.stringify(existingFields || {}));
  for (const file of files || []) {
    form.append('files', await fileBlob(file), file.name || 'image');
  }
  return request('/api/recognitions', { method: 'POST', body: form });
}

export function validateFeishu(tableUrl) {
  return request('/api/feishu/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableUrl }),
  });
}

export function getFeishuConfig() {
  return request('/api/feishu/config');
}

export function saveFeishuConfig(appId, appSecret) {
  return request('/api/feishu/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, appSecret }),
  });
}

export function writeFeishu(payload) {
  return request('/api/feishu/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
