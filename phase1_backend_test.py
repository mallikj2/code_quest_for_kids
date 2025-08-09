#!/usr/bin/env python3
"""
Phase 1 Backend API Tests for CodeQuest Kids
Tests specific requirements from the review request
"""

import requests
import sys
import json
from datetime import datetime

class Phase1APITester:
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

    def test_create_phase1_user(self):
        """Phase 1 Test 1: Create user with name 'Phase1Tester'"""
        try:
            payload = {"name": "Phase1Tester"}
            response = requests.post(f"{self.api_url}/users", json=payload, timeout=10)
            if response.status_code != 200:
                return self.log_test("Create Phase1Tester User", False, f"Status: {response.status_code}")
            
            user_data = response.json()
            self.user_id = user_data.get("id")
            success = (self.user_id is not None and 
                      len(self.user_id) > 10 and  # UUID-like
                      user_data.get("name") == "Phase1Tester")
            details = f"User ID: {self.user_id}, Name: {user_data.get('name')}"
            return self.log_test("Create Phase1Tester User", success, details)
        except Exception as e:
            return self.log_test("Create Phase1Tester User", False, f"Error: {str(e)}")

    def test_hints_based_points_decay_with_hint(self):
        """Phase 1 Test 2: Test hints-based points decay with 1 hint used (expect 8 points)"""
        if not self.user_id:
            return self.log_test("Hints Decay (1 hint)", False, "No user ID available")
        
        try:
            payload = {
                "user_id": self.user_id,
                "level_id": "1",
                "code": "pet='cat'\nprint(pet)",
                "hints_used": 1
            }
            response = requests.post(f"{self.api_url}/execute_code", json=payload, timeout=15)
            if response.status_code != 200:
                return self.log_test("Hints Decay (1 hint)", False, f"Status: {response.status_code}")
            
            result = response.json()
            success = (result.get("passed") == True and 
                      result.get("points_earned") == 8 and  # 10 * 0.8 = 8
                      "cat" in result.get("output", ""))
            details = f"Passed: {result.get('passed')}, Points: {result.get('points_earned')} (expected 8), Output: '{result.get('output', '')}'"
            return self.log_test("Hints Decay (1 hint)", success, details)
        except Exception as e:
            return self.log_test("Hints Decay (1 hint)", False, f"Error: {str(e)}")

    def test_hints_based_points_no_decay(self):
        """Phase 1 Test 3: Test hints-based points with no hints used (expect 10 points)"""
        if not self.user_id:
            return self.log_test("No Hints Decay (0 hints)", False, "No user ID available")
        
        try:
            payload = {
                "user_id": self.user_id,
                "level_id": "1",
                "code": "pet='cat'\nprint(pet)",
                "hints_used": 0
            }
            response = requests.post(f"{self.api_url}/execute_code", json=payload, timeout=15)
            if response.status_code != 200:
                return self.log_test("No Hints Decay (0 hints)", False, f"Status: {response.status_code}")
            
            result = response.json()
            success = (result.get("passed") == True and 
                      result.get("points_earned") == 10 and  # Full points
                      "cat" in result.get("output", ""))
            details = f"Passed: {result.get('passed')}, Points: {result.get('points_earned')} (expected 10), Output: '{result.get('output', '')}'"
            return self.log_test("No Hints Decay (0 hints)", success, details)
        except Exception as e:
            return self.log_test("No Hints Decay (0 hints)", False, f"Error: {str(e)}")

    def test_api_output_verification(self):
        """Phase 1 Test 4: Verify API still returns output 'cat'"""
        if not self.user_id:
            return self.log_test("API Output Verification", False, "No user ID available")
        
        try:
            payload = {
                "user_id": self.user_id,
                "level_id": "1",
                "code": "pet='cat'\nprint(pet)",
                "hints_used": 0
            }
            response = requests.post(f"{self.api_url}/execute_code", json=payload, timeout=15)
            if response.status_code != 200:
                return self.log_test("API Output Verification", False, f"Status: {response.status_code}")
            
            result = response.json()
            output = result.get("output", "").strip()
            success = (output == "cat")
            details = f"Output: '{output}' (expected 'cat')"
            return self.log_test("API Output Verification", success, details)
        except Exception as e:
            return self.log_test("API Output Verification", False, f"Error: {str(e)}")

    def run_phase1_tests(self):
        """Run Phase 1 backend tests as specified in review request"""
        print("🚀 Starting Phase 1 Backend API Tests for CodeQuest Kids")
        print(f"🌐 Testing against: {self.api_url}")
        print("=" * 70)
        
        # Run Phase 1 tests in sequence
        self.test_create_phase1_user()
        self.test_hints_based_points_decay_with_hint()
        self.test_hints_based_points_no_decay()
        self.test_api_output_verification()
        
        # Print summary
        print("=" * 70)
        print(f"📊 Phase 1 Backend Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All Phase 1 backend tests passed!")
            return True
        else:
            print("⚠️  Some Phase 1 backend tests failed")
            return False

def main():
    """Main test runner"""
    tester = Phase1APITester()
    success = tester.run_phase1_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())