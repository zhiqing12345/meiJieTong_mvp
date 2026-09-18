# 媒介通 · 本地识别版

当前版本完成两步闭环：上传媒体回执、交通或住宿资料，由多模态模型识别结构化字段；业务老师逐项核对后，将确认结果写入飞书电子表格。

## 识别字段

- 人员信息：出席人、职位、联系方式、身份证号码
- 去程：交通类型、日期、出发地、抵达地、航班/车次、到达航站楼/高铁站、出发时间、抵达时间
- 返程：交通类型、日期、出发地、抵达地、航班/车次、出发航站楼/高铁站、出发时间、抵达时间
- 住宿：住宿日期

日期在识别和核对页面中统一为 `yyyy-MM-dd`。导出的 CSV 也保留这个格式；未来回填电子表格时再转换为表格日期值。

## 运行环境

- Node.js 20+
- Java 21+
- Maven 3.9+
- 国内模型中转（默认使用支持图片输入的 `deepseek-flash`）

## 配置模型

在 PowerShell 中设置环境变量。不要把真实密钥写进仓库：

```powershell
$env:MEIJIETONG_AI_API_KEY = "你的模型密钥"
$env:MEIJIETONG_AI_BASE_URL = "https://bmc-llm-relay.bluemediagroup.cn"
$env:MEIJIETONG_AI_MODEL = "deepseek-flash"
$env:MEIJIETONG_FEISHU_APP_ID = "你的飞书应用 App ID"
$env:MEIJIETONG_FEISHU_APP_SECRET = "你的飞书应用 App Secret"
$env:MEIJIETONG_FEISHU_TABLE_URL = "带 sheet 参数的飞书电子表格或知识库链接"
```

飞书应用需要开通知识库节点读取和电子表格读写权限，并能访问目标文档。回填按目标表结构分段写入：人员信息 `N:Q`、去程 `U:AA`、返程 `AD:AJ`、住宿日期 `AM`；中间的拉流、出票及接送站字段保持空白。同一本地记录重复提交不会重复写入。

也可以在每个活动右上角打开“飞书配置”，点击机器人图标录入 App ID 与 App Secret。凭证由本机后端验证并保存在本地 SQLite，浏览器只会看到脱敏 App ID，不会读取或保存 Secret。

## 启动

终端一：

```powershell
cd backend
mvn spring-boot:run
```

终端二：

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。

## 本地数据

- 活动、识别字段、人工确认和飞书写入状态保存在当前浏览器。
- AI 识别任务及错误记录保存在 `%USERPROFILE%/.meijietong/meijietong.db`。
- 上传图片只在识别请求中发送给配置的模型服务，不会在本地长期保存。
- 身份证号和手机号属于敏感信息，应使用符合团队数据合规要求的模型服务。

## 构建检查

```powershell
npm run build
cd backend
mvn test
```
