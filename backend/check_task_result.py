from app.workers.celery_app import celery
res = celery.AsyncResult('c73b0f1b-888f-4fe3-a4bc-6c16d3bec3d7')
print('status=', res.status)
print('info=', res.info)
