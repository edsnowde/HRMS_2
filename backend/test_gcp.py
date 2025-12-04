from google.cloud import storage
import os

# Ensure credentials path is set
print("🔹 GCP Credential Path:", os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

try:
    client = storage.Client()
    buckets = list(client.list_buckets())
    print("✅ Connected successfully to GCP! Buckets:")
    for b in buckets:
        print("-", b.name)
except Exception as e:
    print("❌ GCP connection failed:", e)
