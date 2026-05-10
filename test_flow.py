
import os
import time
import random
import string
from playwright.sync_api import sync_playwright

def get_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def run_audit():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport for screenshots
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()
        
        print("1. Navigating to landing page...")
        page.goto('http://localhost:3000')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='audit_01_landing.png', full_page=True)
        
        print("2. Pasting code snippet...")
        code_snippet = """
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)
"""
        page.fill('textarea[placeholder*="Paste your code"]', code_snippet)
        
        print("3. Clicking Visualize Logic...")
        page.click('button:has-text("Visualize Logic")')
        
        # Check if Register modal appears
        print("4. Handling Registration...")
        page.wait_for_selector('text=Save Your Logic Map', timeout=5000)
        
        username = f"testuser_{get_random_string()}"
        email = f"{username}@example.com"
        password = "Password123!"
        
        page.fill('input[placeholder="coder_01"]', username)
        page.fill('input[placeholder="you@example.com"]', email)
        page.fill('input[placeholder="••••••••"]', password)
        page.click('button:has-text("Unlock Mastery Path")')
        
        print("5. Verifying AnalyzingBridge...")
        try:
            # The bridge should appear immediately
            page.wait_for_selector('[data-testid="analyzing-bridge"]', timeout=5000)
            print("   AnalyzingBridge visible.")
            page.screenshot(path='audit_05_analyzing.png')
        except:
            # Fallback check for any part of the bridge
            if page.locator('text=Constructing Logic Topology').count() > 0:
                 print("   AnalyzingBridge detected by text.")
            else:
                 print("   AnalyzingBridge NOT detected.")
            
        print("6. Waiting for redirect to SpaceDetail...")
        page.wait_for_url('**/space/*', timeout=30000)
        print(f"   Redirected to: {page.url}")
        page.wait_for_load_state('networkidle')
        
        print("7. Waiting for Learning Path Generation (Polling)...")
        # In SpaceDetail, if no path, it shows "Forging Your Mastery Path..."
        try:
            # Wait until the "lessons" are visible or the "Preparing" state is gone
            page.wait_for_selector('text=lessons', timeout=60000)
            print("   Learning path generated.")
            page.screenshot(path='audit_07_space_detail_ready.png', full_page=True)
        except Exception as e:
            print(f"   Timed out waiting for learning path: {e}")
            page.screenshot(path='audit_07_failed_path.png')
            browser.close()
            return

        print("8. Clicking first lesson...")
        # Select the first lesson button
        first_lesson = page.locator('button:has-text("1")').first
        first_lesson.click()
        
        print("9. Verifying Learn Page...")
        page.wait_for_url('**/learn/*', timeout=10000)
        page.wait_for_load_state('networkidle')
        
        # Wait for content to load (it might poll if content is null)
        try:
            page.wait_for_selector('text=Conceptual Targets', timeout=30000)
            print("   Learn Page content loaded.")
        except:
             print("   Timed out waiting for Learn Page content.")

        time.sleep(2) # Stabilize
        page.screenshot(path='audit_09_learn_page.png', full_page=True)

        # Functional Checks
        viz_present = page.locator('canvas').count() > 0 or page.locator('[class*="AnimationPlayer"]').count() > 0
        print(f"   Logic Visualization (AnimationPlayer) present: {viz_present}")
        
        mentor_present = page.locator('text=AI Mentor').count() > 0
        print(f"   AI Mentor present: {mentor_present}")
        
        concepts_present = page.locator('text=Conceptual Targets').count() > 0
        print(f"   Conceptual Targets present: {concepts_present}")
        
        deep_dive_present = page.locator('text=Architectural Insight').count() > 0 or page.locator('text=Deep Dive').count() > 0
        print(f"   Technical Deep Dive present: {deep_dive_present}")

        # Human-Centric UX Audit markers
        # Check fonts/contrast (indirectly by ensuring elements are visible and readable in screenshot)
        
        browser.close()

if __name__ == "__main__":
    run_audit()
