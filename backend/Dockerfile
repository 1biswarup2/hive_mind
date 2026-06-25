FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Build tools for any packages that need to compile (kept minimal).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# emergentintegrations is hosted on Emergent's package index, not PyPI.
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
       --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

COPY . .

EXPOSE 8080

# Cloud Run injects $PORT (defaults to 8080). Shell form so $PORT expands.
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1
