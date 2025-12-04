from app.config import settings
from pymongo import MongoClient
import json
mongo_url = getattr(settings, 'mongo_url', None) or 'mongodb://localhost:27017/auralis_hr'
mongo_db = getattr(settings, 'mongo_db_name', 'ai_ats')
print('mongo_url=', mongo_url)
client = MongoClient(mongo_url)
db = client[mongo_db]
app = db.applications.find_one({'application_id':'APL-77A8F0C7'})
print(json.dumps(app, default=str, indent=2))
