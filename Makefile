# Makefile for jsexecutor

# 构建Docker镜像
build:
	docker build -t visolleon/jsexecutor:latest .

# 标签镜像（用于上传到Docker Hub）
tag:
	docker tag jsexecutor:latest visolleon/jsexecutor:latest

# 上传镜像到Docker Hub
push:
	docker push visolleon/jsexecutor:latest

# 运行容器
run:
	docker run -d \
	--name jsexecutor \
	-p 3001:3001 \
	-v ./tasks:/app/tasks \
	-e API_TOKEN=your-secret-token \
	-e FILE_URL_PREFIX=http://localhost:3001 \
	-e SERVER_HOST=localhost \
	-e SERVER_PORT=3001 \
	jsexecutor:latest

# 停止容器
stop:
	docker stop jsexecutor
	docker rm jsexecutor

# 查看容器状态
status:
	docker ps -f name=jsexecutor

# 查看容器日志
logs:
	docker logs -f jsexecutor

# 进入容器
exec:
	docker exec -it jsexecutor sh

# 清理Docker资源
clean:
	docker stop jsexecutor 2>/dev/null || true
	docker rm jsexecutor 2>/dev/null || true
	docker rmi jsexecutor:latest 2>/dev/null || true

# 运行测试
test:
	curl -X POST http://localhost:3001/execute \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer your-secret-token" \
	-d '{"code": "const fs = require(\"fs\"); fs.writeFileSync(\"test.txt\", \"Test file\");"}'

.PHONY: build tag push run stop status logs exec clean test