import redis

r = redis.from_url("redis://localhost:6379/0")
r.ping()
print("✅ Connected successfully to Redis!")
