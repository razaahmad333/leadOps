#!/bin/bash
set -e

USER="razaahmad333"
REPO="leadops"
SHA=$(git rev-parse --short HEAD)
PLATFORM="linux/amd64"
BUILDER="multiarch-builder"

echo "Using buildx builder: $BUILDER"
docker buildx inspect "$BUILDER" >/dev/null 2>&1 || docker buildx create --name "$BUILDER" --use
docker buildx use "$BUILDER"
docker buildx inspect --bootstrap >/dev/null

echo "Building and pushing API image for $PLATFORM..."
docker buildx build \
  --platform $PLATFORM \
  -f apps/api/Dockerfile \
  -t ghcr.io/$USER/${REPO}-api:latest \
  -t ghcr.io/$USER/${REPO}-api:$SHA \
  --push \
  .

echo "Building and pushing Worker image for $PLATFORM..."
docker buildx build \
  --platform $PLATFORM \
  -f apps/worker/Dockerfile \
  -t ghcr.io/$USER/${REPO}-worker:latest \
  -t ghcr.io/$USER/${REPO}-worker:$SHA \
  --push \
  .

echo "Done."
echo "API:    ghcr.io/$USER/${REPO}-api:latest"
echo "API:    ghcr.io/$USER/${REPO}-api:$SHA"
echo "Worker: ghcr.io/$USER/${REPO}-worker:latest"
echo "Worker: ghcr.io/$USER/${REPO}-worker:$SHA"
