#!/usr/bin/env python3
"""
Test runner for AI services
"""
import sys
import subprocess
import os

def run_tests():
    """Run all tests with coverage"""
    print("Running AI Services Tests...")
    print("=" * 50)
    
    # Set environment variables for testing
    os.environ['GOOGLE_CLOUD_PROJECT'] = 'test-project'
    os.environ['TESTING'] = 'true'
    
    # Run tests with pytest
    test_files = [
        'test_gemini_service.py',
        'test_middleware.py'
    ]
    
    all_passed = True
    
    for test_file in test_files:
        print(f"\nRunning {test_file}...")
        print("-" * 30)
        
        try:
            result = subprocess.run([
                sys.executable, '-m', 'pytest', 
                test_file, 
                '-v',
                '--tb=short',
                '--color=yes'
            ], check=True, capture_output=False)
            
            print(f"✅ {test_file} passed")
            
        except subprocess.CalledProcessError as e:
            print(f"❌ {test_file} failed with exit code {e.returncode}")
            all_passed = False
        except FileNotFoundError:
            print(f"⚠️  {test_file} not found, skipping...")
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All tests passed!")
        return 0
    else:
        print("💥 Some tests failed!")
        return 1

if __name__ == '__main__':
    sys.exit(run_tests())