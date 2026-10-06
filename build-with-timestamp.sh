
#!/bin/bash

# Build Docker image with timestamp tag
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
IMAGE_NAME="kafka-nextjs-dashboard"
TAG="${IMAGE_NAME}:${TIMESTAMP}"
TAR_FILE="${IMAGE_NAME}-${TIMESTAMP}.tar"

echo "🐳 Building Docker image: $TAG"
docker build --no-cache -t $TAG .

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Image tagged as: $TAG"
    echo "🏷️  Also tagging as: ${IMAGE_NAME}:latest"
    docker tag $TAG "${IMAGE_NAME}:latest"
    echo "✅ Latest tag updated"
    
    echo "📦 Creating tar archive: $TAR_FILE"
    docker save -o "$TAR_FILE" $TAG
    
    if [ $? -eq 0 ]; then
        echo "✅ Tar archive created: $TAR_FILE"
        ls -lh "$TAR_FILE"
    else
        echo "❌ Failed to create tar archive!"
        exit 1
    fi
else
    echo "❌ Build failed!"
    exit 1
fi
