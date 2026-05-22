@echo off
cd /d "d:\AI-Code\Bird"

set LOGFILE=d:\AI-Code\Bird\logs\service.log
echo [%DATE% %TIME%] BirdAI 服務啟動 >> "%LOGFILE%"

"C:\Users\Bonds\AppData\Local\Python\pythoncore-3.14-64\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 >> "%LOGFILE%" 2>&1

echo [%DATE% %TIME%] BirdAI 服務已停止 >> "%LOGFILE%"
