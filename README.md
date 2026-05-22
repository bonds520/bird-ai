# 鳥類辨識系統 Bird AI

本地部署的鳥類（及任意主題）影像辨識與批次篩選系統，不依賴任何雲端 API。

---

## 功能總覽

| 功能 | 說明 |
|------|------|
| **圖片辨識** | 上傳照片（含 RAW 格式），本地視覺 AI 辨識鳥種 |
| **鳴聲辨識** | 上傳音訊，BirdNET 神經網路辨識鳥種 |
| **觀察記錄** | 儲存辨識結果、GPS 位置、日期備註，支援搜尋與刪除 |
| **辨識更正** | AI 推薦相似物種，支援人工更正並同步記錄 |
| **批次篩選** | 整資料夾照片自動篩選：模糊偵測 + 主體對焦 + AI 主題判斷 |
| **多模型切換** | 前端選單即時切換 LM Studio 已載入的任何視覺模型 |
| **區網存取** | 服務監聽 0.0.0.0，區網其他裝置直接存取 |
| **開機自動啟動** | Windows 登入時背景自動啟動，無需手動操作 |

---

## 技術架構

| 元件 | 技術 |
|------|------|
| 後端框架 | FastAPI + Python 3.14 + SQLite |
| 視覺 AI | OpenAI-compatible API（LM Studio，支援任意視覺模型） |
| 音訊辨識 | BirdNET-Analyzer（birdnetlib） |
| 影像處理 | Pillow + NumPy + rawpy（支援 CR2/NEF/ARW 等 RAW 格式） |
| 前端 | 純 HTML / CSS / JavaScript，無外部框架 |
| 批次處理 | ThreadPoolExecutor 背景非同步執行 |

---

## 本地視覺模型建議

| 模型 | 大小 | 視覺能力 | 說明 |
|------|------|----------|------|
| **Qwen2.5-VL-7B** | 7B | ✅ | 推薦，速度快、準確度高 |
| Gemma4-26B | 26B | ✅ | 可用，較慢 |
| Qwen3.6-27B | 27B | ❌ | 純語言模型，**無法看圖** |

> LM Studio 搜尋 `qwen2.5-vl-7b` 下載，透過前端選單選擇即可切換。

---

## 快速啟動

```bash
# 安裝依賴
pip install -r requirements.txt

# 設定環境（複製後填入 LM Studio 位址）
copy .env.example .env

# 啟動服務
python main.py
```

開啟瀏覽器：`http://localhost:8000`

---

## 環境設定（`.env`）

```ini
LLM_API_BASE=http://your-lmstudio-ip:1234/v1   # LM Studio 位址
LLM_API_KEY=not-required
LLM_MODEL=qwen/qwen2.5-vl-7b                    # 預設模型 ID

DEFAULT_LAT=25.0330       # 台灣座標（提升 BirdNET 辨識準確率）
DEFAULT_LON=121.5654
BIRDNET_MIN_CONF=0.10     # 最低辨識信心度
MAX_UPLOAD_BYTES=104857600  # 上傳上限 100MB
```

---

## API 端點

| 方法 | 路徑 | 功能 |
|------|------|------|
| GET | `/api/models` | 取得 LM Studio 可用模型清單 |
| POST | `/api/identify/image` | 圖片辨識 |
| POST | `/api/identify/audio` | 音訊辨識 |
| POST | `/api/identify/alternatives` | 取得相似物種（更正用） |
| GET | `/api/records` | 查詢觀察記錄 |
| POST | `/api/records` | 新增記錄 |
| PATCH | `/api/records/{id}` | 更新記錄（更正物種） |
| DELETE | `/api/records/{id}` | 刪除記錄 |
| GET | `/api/batch/validate` | 驗證來源資料夾 |
| POST | `/api/batch/start` | 啟動批次篩選任務 |
| GET | `/api/batch/{id}/status` | 查詢任務進度 |
| GET | `/api/batch/{id}/result` | 取得完整篩選結果 |
| POST | `/api/batch/{id}/cancel` | 中止任務 |

---

## Windows 自動啟動

登入時自動在背景靜默啟動，不顯示視窗：

```
啟動腳本：d:\AI-Code\Bird\bird_service.bat
觸發器：  %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BirdAI.vbs
日誌：    d:\AI-Code\Bird\logs\service.log
區網網址：http://<本機IP>:8000
```

詳細開發記錄見 [CHANGELOG.md](CHANGELOG.md)。
