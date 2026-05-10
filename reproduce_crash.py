
import os
import time
from playwright.sync_api import sync_playwright

def test_empty_frames_crash():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}") if msg.type == "error" else None)

        print("Navigating to landing...")
        page.goto("http://localhost:3000")
        
        # We need to login or bypass auth if possible. 
        # Since I can't easily bypass auth without knowing the DB state, 
        # I'll try to register a new user as in test_flow.py
        
        print("Pasting code and registering...")
        code = "def hello(): pass"
        page.fill('textarea[placeholder*="Paste your code"]', code)
        page.click('button:has-text("Visualize Logic")')
        
        page.wait_for_selector('text=Save Your Logic Map', timeout=5000)
        username = f"bugtest_{int(time.time())}"
        page.fill('input[placeholder="coder_01"]', username)
        page.fill('input[placeholder="you@example.com"]', f"{username}@example.com")
        page.fill('input[placeholder="••••••••"]', "Password123!")
        page.click('button:has-text("Unlock Mastery Path")')
        
        print("Waiting for SpaceDetail...")
        page.wait_for_url("**/space/*", timeout=30000)
        
        print("Waiting for lessons...")
        page.wait_for_selector('button:has-text("1")', timeout=60000)
        
        # Now, I want to intercept the lesson API call and return empty animation_frames
        def handle_route(route):
            response = route.fetch()
            json_data = response.json()
            if "content" in json_data and json_data["content"]:
                json_data["content"]["animation_frames"] = []
            route.fulfill(json=json_data)

        page.route("**/api/v1/learning/lesson/*", handle_route)
        
        print("Clicking first lesson...")
        page.click('button:has-text("1")')
        
        time.sleep(5) # Wait for render
        
        if errors:
            print("FOUND ERRORS:")
            for err in errors:
                print(f"  - {err}")
        else:
            print("No errors detected (yet).")
            
        page.screenshot(path="repro_blank_screen.png")
        
        browser.close()

if __name__ == "__main__":
    test_empty_frames_crash()
