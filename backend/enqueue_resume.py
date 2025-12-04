from app.workers.resume_worker import process_resume

if __name__ == '__main__':
    res = process_resume.delay('APL-77A8F0C7','gs://hrms-resumes-bucket/resumes/APL-77A8F0C7/cf7f225a-fcb3-4055-b016-ba99670b383d.pdf')
    print('enqueued', res.id)
