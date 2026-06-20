# Build backend image
FROM python:3.11-slim

WORKDIR /app

# Install system utilities needed for building scikit-learn if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ /app/backend
COPY ml/ /app/ml

# Expose port
EXPOSE 8000

# Set Python path to import backend modules correctly
ENV PYTHONPATH=/app

# Start server
CMD ["python", "backend/main.py"]
