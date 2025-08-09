#!/usr/bin/env python3
"""
Backend API Tests for CodeQuest Kids
Tests all API endpoints as specified in the review request
"""

import requests
import sys
import json
from datetime import datetime

class CodeQuestAPITester:
    def __init__(self, base_url="https://87019c7b-196c-423a-a6b0-f45105066303.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_health_check(self):
        """Test 1: Backend health check"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = (response.status_code == 200 and 
                      "CodeQuest Kids API" in response.json().get("message", ""))
            details = f"Status: {response.status_code}, Message: {response.json().get('message', 'N/A')}"
            return self.log_test("Health Check", success, details)
        except Exception as e:
            return self.log_test("Health Check", False, f"Error: {str(e)}")

    def test_get_levels(self):
        """Test 2: Get levels endpoint"""
        try:
            response = requests.get(f"{self.api_url}/levels", timeout=10)
            if response.status_code != 200:
                return self.log_test("Get Levels", False, f"Status: {response.status_code}")
            
            levels = response.json()
            success = (len(levels) == 10 and 
                      levels[0].get("title") == "Variables Explorer" and
                      levels[0].get("id") == "1")
            details = f"Count: {len(levels)}, First level: {levels[0].get('title', 'N/A')}"
            return self.log_test("Get Levels", success, details)
        except Exception as e:
            return self.log_test("Get Levels", False, f"Error: {str(e)}")

    def test_create_user(self):
        """Test 3: Create user"""
        try:
            payload = {"name": "Test"}
            response = requests.post(f"{self.api_url}/users", json=payload, timeout=10)
            if response.status_code != 200:
                return self.log_test("Create User", False, f"Status: {response.status_code}")
            
            user_data = response.json()
            self.user_id = user_data.get("id")
            success = (self.user_id is not None and 
                      len(self.user_id) > 10 and  # UUID-like
                      user_data.get("name") == "Test")
            details = f"User ID: {self.user_id}, Name: {user_data.get('name')}"
            return self.log_test("Create User", success, details)
        except Exception as e:
            return self.log_test("Create User", False, f"Error: {str(e)}")

    def test_execute_code(self):
        """Test 4: Execute code happy path"""
        if not self.user_id:
            return self.log_test("Execute Code", False, "No user ID available")
        
        try:
            payload = {
                "user_id": self.user_id,
                "level_id": "1",
                "code": "pet = 'cat'\nprint(pet)"
            }
            response = requests.post(f"{self.api_url}/execute_code", json=payload, timeout=15)
            if response.status_code != 200:
                return self.log_test("Execute Code", False, f"Status: {response.status_code}")
            
            result = response.json()
            success = (result.get("passed") == True and 
                      result.get("points_earned", 0) > 0 and
                      "cat" in result.get("output", ""))
            details = f"Passed: {result.get('passed')}, Points: {result.get('points_earned')}, Output: '{result.get('output', '')[:50]}'"
            return self.log_test("Execute Code", success, details)
        except Exception as e:
            return self.log_test("Execute Code", False, f"Error: {str(e)}")

    def test_user_progress(self):
        """Test 5: Get user progress"""
        if not self.user_id:
            return self.log_test("User Progress", False, "No user ID available")
        
        try:
            response = requests.get(f"{self.api_url}/users/{self.user_id}/progress", timeout=10)
            if response.status_code != 200:
                return self.log_test("User Progress", False, f"Status: {response.status_code}")
            
            progress = response.json()
            success = (progress.get("total_points", 0) >= 10 and  # Should have points from code execution
                      "1" in progress.get("passed_levels", []))  # Should include level 1
            details = f"Total points: {progress.get('total_points')}, Passed levels: {progress.get('passed_levels')}"
            return self.log_test("User Progress", success, details)
        except Exception as e:
            return self.log_test("User Progress", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting CodeQuest Kids Backend API Tests")
        print(f"🌐 Testing against: {self.api_url}")
        print("=" * 60)
        
        # Run tests in sequence
        self.test_health_check()
        self.test_get_levels()
        self.test_create_user()
        self.test_execute_code()
        self.test_user_progress()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed")
            return False

def main():
    """Main test runner"""
    tester = CodeQuestAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())