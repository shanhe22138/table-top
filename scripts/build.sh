#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
IMAGE_NAME=${IMAGE_NAME:-table-top-app}
IMAGE_TAG=${IMAGE_TAG:-1.0.0}
NODE_IMAGE=${NODE_IMAGE:-node:24-bookworm}
MAVEN_IMAGE=${MAVEN_IMAGE:-maven:3.9.11-eclipse-temurin-21}
MAVEN_CACHE_VOLUME=${MAVEN_CACHE_VOLUME:-table-top-maven-cache}

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：构建只需要 Docker，但当前未找到 docker 命令" >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  docker run --rm -v "$ROOT_DIR:/workspace" -w /workspace "$NODE_IMAGE" npm ci
fi

docker run --rm -v "$ROOT_DIR:/workspace" -w /workspace "$NODE_IMAGE" npm run typecheck
docker run --rm -v "$ROOT_DIR:/workspace" -w /workspace "$NODE_IMAGE" npm run build

if [[ ${BUILD_WEAPP:-0} == 1 ]]; then
  docker run --rm -v "$ROOT_DIR:/workspace" -w /workspace "$NODE_IMAGE" npm run build:weapp
fi
if [[ ${BUILD_H5:-0} == 1 ]]; then
  docker run --rm -v "$ROOT_DIR:/workspace" -w /workspace "$NODE_IMAGE" npm run build:h5
fi

if [[ ${SKIP_TESTS:-0} != 1 ]]; then
  docker run --rm --network host \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$MAVEN_CACHE_VOLUME:/root/.m2" \
    -v "$ROOT_DIR:/workspace" -w /workspace/backend \
    "$MAVEN_IMAGE" ./mvnw clean verify
else
  docker run --rm -v "$MAVEN_CACHE_VOLUME:/root/.m2" \
    -v "$ROOT_DIR:/workspace" -w /workspace/backend \
    "$MAVEN_IMAGE" ./mvnw clean package -DskipTests
fi

docker build -t "$IMAGE_NAME:$IMAGE_TAG" "$ROOT_DIR"
echo "镜像已构建：$IMAGE_NAME:$IMAGE_TAG"
