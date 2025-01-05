import requests
import json

def test_endpoint(url, expected_status=200):
    print(f"\nTesting endpoint: {url}")
    try:
        response = requests.get(url)
        print(f"Status code: {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
            return False
            
        try:
            data = response.json()
            print("✅ Response is valid JSON")
            print(f"Response type: {type(data)}")
            if isinstance(data, list):
                print(f"Array length: {len(data)}")
                if len(data) > 0:
                    print("First item sample:", json.dumps(data[0], indent=2))
            return True
        except json.JSONDecodeError:
            print("❌ Response is not valid JSON")
            print("Raw response:", response.text[:200])
            return False
            
    except requests.RequestException as e:
        print(f"❌ Request failed: {str(e)}")
        return False

def main():
    # Base URLs to test
    base_urls = [
        "http://localhost:8000",
        "https://4df5-101-0-62-223.ngrok-free.app"
    ]
    
    # Endpoints to test
    endpoints = [
        "/races/calendar/2024",
        "/races/calendar/2023",
        "/"  # Health check endpoint
    ]
    
    for base_url in base_urls:
        print(f"\n=== Testing {base_url} ===")
        for endpoint in endpoints:
            url = f"{base_url}{endpoint}"
            test_endpoint(url)

if __name__ == "__main__":
    main() 