import sys
import time
from playwright.sync_api import sync_playwright

def test_active_discovery():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Login with the previously created user if possible, or just register again.
        # Actually, let's just use the existing database since it's local.
        # But I don't know the exact username/password easily.
        # I'll just register a new one for this test too.
        
        print("Registering for discovery test...")
        page.goto("http://localhost:3000/register")
        username = f"discover_{int(time.time())}"
        page.fill("#email", f"{username}@example.com")
        page.fill("#username", username)
        page.fill("#password", "Password123!")
        page.click("button:has-text('Create Account')")

        page.wait_for_url("**/assessment", timeout=30000)
        code = "def check(x):\n  if x > 0:\n    return True\n  else:\n    return False"
        page.fill("textarea", code)
        page.click("button:has-text('Analyze My Code')")

        print("Analyzing...")
        page.wait_for_selector("text=Question 1 of", timeout=120000)
        for i in range(10):
            page.wait_for_selector("button.w-full.rounded-xl")
            page.locator("button.w-full.rounded-xl").first.click()
            page.wait_for_selector("button:has-text('Next Question'), button:has-text('See Results')")
            page.click("button:has-text('Next Question'), button:has-text('See Results')")

        page.wait_for_url("**/dashboard", timeout=60000)
        page.wait_for_selector("button.group.relative.w-full")
        page.locator("button.group.relative.w-full").first.click()
        
        page.wait_for_url("**/space/*", timeout=30000)
        page.wait_for_selector("button.w-full.rounded-xl.border.border-slate-700")
        page.locator("button.w-full.rounded-xl.border.border-slate-700").first.click()
        
        page.wait_for_url("**/learn/*", timeout=30000)
        page.wait_for_load_state("networkidle")

        print("Navigating frames to find a checkpoint...")
        # Try to click "Proceed" multiple times
        for i in range(5):
            proceed_btn = page.locator("button:has-text('Proceed')")
            if proceed_btn.is_disabled():
                print(f"Frame {i+1}: Proceed is disabled. Checking for Discovery Gate...")
                gate = page.locator("text=Discovery Gate")
                if gate.is_visible():
                    print("Verified: Discovery Gate (Checkpoint) reached!")
                    page.screenshot(path='checkpoint_active.png')
                    
                    # Try to click "REVEAL OUTCOME"
                    reveal_btn = page.locator("button:has-text('REVEAL OUTCOME')")
                    if reveal_btn.is_visible():
                        print("Clicking REVEAL OUTCOME...")
                        reveal_btn.click()
                        time.sleep(1)
                        if not proceed_btn.is_disabled():
                            print("Verified: Proceed is now enabled after reveal.")
                            page.screenshot(path='checkpoint_cleared.png')
                            break
            else:
                print(f"Frame {i+1}: Proceed is enabled. Moving to next frame.")
                proceed_btn.click()
                time.sleep(1)

        browser.close()

if __name__ == "__main__":
    test_active_discovery()
