#!/usr/bin/env python3
"""
Simple test script to verify the AI HRMS & ATS system is working correctly.
Run this after starting the system to verify all components are functioning.
"""

import requests
import json
import time
import os
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_RESUME_PATH = "sample_resume.pdf"  # You'll need to create this


class SystemTester:
    """Test the AI HRMS & ATS system components."""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = {}
    
    def test_health_check(self) -> bool:
        """Test system health endpoint."""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                health_data = response.json()
                print("✅ Health check passed")
                print(f"   Status: {health_data.get('status')}")
                print(f"   Version: {health_data.get('version')}")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {str(e)}")
            return False
    
    def test_api_docs(self) -> bool:
        """Test API documentation endpoint."""
        try:
            response = self.session.get(f"{self.base_url}/docs")
            if response.status_code == 200:
                print("✅ API docs accessible")
                return True
            else:
                print(f"❌ API docs failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ API docs error: {str(e)}")
            return False
    
    def test_jobs_status(self) -> bool:
        """Test jobs status endpoint."""
        try:
            response = self.session.get(f"{self.base_url}/jobs/status")
            if response.status_code == 200:
                status_data = response.json()
                print("✅ Jobs status endpoint working")
                print(f"   Total jobs: {status_data.get('total_jobs', 0)}")
                return True
            else:
                print(f"❌ Jobs status failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Jobs status error: {str(e)}")
            return False
    
    def test_resume_upload(self) -> bool:
        """Test resume upload endpoint (without authentication for demo)."""
        try:
            # Create a simple test PDF content
            test_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(John Doe - Software Engineer) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000110 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF"
            
            files = {
                'file': ('test_resume.pdf', test_content, 'application/pdf')
            }
            
            response = self.session.post(
                f"{self.base_url}/resume/upload",
                files=files,
                timeout=30
            )
            
            if response.status_code in [200, 202]:
                upload_data = response.json()
                print("✅ Resume upload endpoint working")
                print(f"   Job ID: {upload_data.get('job_id', 'N/A')}")
                print(f"   Status: {upload_data.get('status', 'N/A')}")
                return True
            else:
                print(f"❌ Resume upload failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Resume upload error: {str(e)}")
            return False
    
    def test_job_matching(self) -> bool:
        """Test job matching endpoint."""
        try:
            job_data = {
                "job_desc": "Looking for a Python developer with 3+ years experience in machine learning and data science. Must have experience with TensorFlow, pandas, and scikit-learn."
            }
            
            response = self.session.post(
                f"{self.base_url}/job/match",
                json=job_data,
                timeout=30
            )
            
            if response.status_code in [200, 202]:
                match_data = response.json()
                print("✅ Job matching endpoint working")
                print(f"   Job ID: {match_data.get('job_id', 'N/A')}")
                print(f"   Status: {match_data.get('status', 'N/A')}")
                return True
            else:
                print(f"❌ Job matching failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Job matching error: {str(e)}")
            return False
    
    def test_chatbot_query(self) -> bool:
        """Test chatbot query endpoint."""
        try:
            chat_data = {
                "query": "What is my leave balance?",
                "user_role": "employee",
                "user_id": "test_user_123"
            }
            
            response = self.session.post(
                f"{self.base_url}/chat/query",
                json=chat_data,
                timeout=30
            )
            
            if response.status_code in [200, 202]:
                chat_response = response.json()
                print("✅ Chatbot endpoint working")
                print(f"   Query: {chat_data['query']}")
                print(f"   Response: {chat_response.get('response', 'N/A')[:100]}...")
                return True
            else:
                print(f"❌ Chatbot query failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Chatbot query error: {str(e)}")
            return False
    
    def test_metrics_endpoint(self) -> bool:
        """Test Prometheus metrics endpoint."""
        try:
            response = self.session.get(f"{self.base_url}/metrics")
            if response.status_code == 200:
                metrics_content = response.text
                print("✅ Metrics endpoint working")
                print(f"   Metrics lines: {len(metrics_content.splitlines())}")
                return True
            else:
                print(f"❌ Metrics endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Metrics endpoint error: {str(e)}")
            return False
    
    def test_websocket_connection(self) -> bool:
        """Test WebSocket connection (basic check)."""
        try:
            import websocket
            
            def on_message(ws, message):
                print(f"✅ WebSocket message received: {message}")
                ws.close()
            
            def on_error(ws, error):
                print(f"❌ WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                print("✅ WebSocket connection closed")
            
            ws = websocket.WebSocketApp(
                f"ws://localhost:8000/jobs/ws?user_id=test_user",
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            
            # Run for 3 seconds
            ws.run_forever(timeout=3)
            return True
            
        except ImportError:
            print("⚠️  WebSocket test skipped (websocket-client not installed)")
            return True
        except Exception as e:
            print(f"❌ WebSocket test error: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all system tests."""
        print("🚀 Starting AI HRMS & ATS System Tests")
        print("=" * 50)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("API Documentation", self.test_api_docs),
            ("Jobs Status", self.test_jobs_status),
            ("Resume Upload", self.test_resume_upload),
            ("Job Matching", self.test_job_matching),
            ("Chatbot Query", self.test_chatbot_query),
            ("Metrics Endpoint", self.test_metrics_endpoint),
            ("WebSocket Connection", self.test_websocket_connection),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            print(f"\n🧪 Testing {test_name}...")
            try:
                results[test_name] = test_func()
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
                results[test_name] = False
        
        return results
    
    def print_summary(self, results: Dict[str, bool]):
        """Print test summary."""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! System is working correctly.")
        else:
            print("⚠️  Some tests failed. Check the logs above for details.")
        
        return passed == total


def main():
    """Main test function."""
    print("AI HRMS & ATS System Tester")
    print("Make sure the system is running on http://localhost:8000")
    print("Press Enter to continue or Ctrl+C to exit...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\nExiting...")
        return
    
    tester = SystemTester()
    results = tester.run_all_tests()
    success = tester.print_summary(results)
    
    if success:
        print("\n🎯 Next Steps:")
        print("1. Check the API documentation at http://localhost:8000/docs")
        print("2. Try uploading a real resume file")
        print("3. Test the WebSocket connection for real-time updates")
        print("4. Check the metrics at http://localhost:8000/metrics")
        print("5. Monitor worker logs for background processing")
    else:
        print("\n🔧 Troubleshooting:")
        print("1. Make sure all services are running:")
        print("   - FastAPI server (uvicorn app.main:app --reload)")
        print("   - Celery workers (celery -A app.workers.celery_app worker)")
        print("   - Redis server")
        print("   - MongoDB")
        print("2. Check the logs for detailed error messages")
        print("3. Verify your .env configuration")
        print("4. Ensure all required API keys are set")


if __name__ == "__main__":
    main()
