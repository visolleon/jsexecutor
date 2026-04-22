# Makefile for jsexector

# 构建Docker镜像
build:
	docker build -t visolleon/jsexector:latest .

# 标签镜像（用于上传到Docker Hub）
tag:
	docker tag jsexector:latest visolleon/jsexector:latest

# 上传镜像到Docker Hub
push:
	docker push visolleon/jsexector:latest

# 运行容器
run:
	docker run -d \
	--name jsexector \
	-p 3001:3001 \
	-v ./tasks:/app/tasks \
	-e API_TOKEN=your-secret-token \
	-e FILE_URL_PREFIX=http://localhost:3001 \
	-e SERVER_HOST=localhost \
	-e SERVER_PORT=3001 \
	jsexector:latest

# 停止容器
stop:
	docker stop jsexector
	docker rm jsexector

# 查看容器状态
status:
	docker ps -f name=jsexector

# 查看容器日志
logs:
	docker logs -f jsexector

# 进入容器
exec:
	docker exec -it jsexector sh

# 清理Docker资源
clean:
	docker stop jsexector 2>/dev/null || true
	docker rm jsexector 2>/dev/null || true
	docker rmi jsexector:latest 2>/dev/null || true

# 运行测试
test:
	curl -X POST http://localhost:3001/execute \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer your-secret-token" \
	-d '{"code": "const fs = require(\"fs\"); fs.writeFileSync(\"test.txt\", \"Test file\");"}'

.PHONY: build tag push run stop status logs exec clean test