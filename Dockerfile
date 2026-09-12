FROM python:3.11-slim

WORKDIR /app

# 安裝系統相依套件 (若後續需轉 PDF 等功能，可在此擴充)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 預設啟動排程主程式
# 若要啟動 API Server 可於 docker-compose.yml 覆寫 command
CMD ["python", "main.py"]
