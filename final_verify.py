
import os
import time
import random
import string
from playwright.sync_api import sync_playwright

def get_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def run_audit():
    audit_results = {
        "functional": {},
        "ux": {}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()
        
        # 1. Landing Page
        print("1. Auditing Landing Page...")
        page.goto('http://localhost:3000')
        page.wait_for_load_state('networkidle')
        
        # UX: Readability
        body_bg = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
        text_color = page.evaluate("window.getComputedStyle(document.querySelector('h1')).color")
        audit_results["ux"]["landing_bg"] = body_bg
        audit_results["ux"]["landing_h1_color"] = text_color
        
        page.screenshot(path='audit_landing.png')
        
        # 2. Functional: Magic Paste
        print("2. Testing Magic Paste...")
        code_snippet = "def hello(): print('world')"
        page.fill('textarea', code_snippet)
        page.click('button:has-text("Visualize Logic")')
        
        # 3. Functional: Register
        print("3. Testing Register Modal...")
        page.wait_for_selector('text=Save Your Logic Map')
        page.screenshot(path='audit_register_modal.png')
        
        username = f"u_{get_random_string()}"
        page.fill('input[placeholder="coder_01"]', username)
        page.fill('input[placeholder="you@example.com"]', f"{username}@test.com")
        page.fill('input[placeholder="••••••••"]', "Password123!")
        page.click('button:has-text("Unlock Mastery Path")')
        
        # 4. Functional: AnalyzingBridge
        print("4. Testing AnalyzingBridge...")
        try:
            page.wait_for_selector('text=Mapping Logic Topologies', timeout=5000)
            audit_results["functional"]["bridge_visible"] = True
            print("   AnalyzingBridge detected.")
        except:
            audit_results["functional"]["bridge_visible"] = False
            print("   AnalyzingBridge NOT detected.")
        
        page.screenshot(path='audit_bridge.png')
        
        # 5. Functional: SpaceDetail
        print("5. Testing SpaceDetail...")
        page.wait_for_url('**/space/*', timeout=15000)
        audit_results["functional"]["redirect_to_space"] = True
        
        # Check for status message
        status_msg = page.locator('text=Forging Your Mastery Path').count() > 0
        audit_results["ux"]["visibility_system_status_space"] = status_msg
        
        page.screenshot(path='audit_space_detail_loading.png')
        
        # Wait for path
        print("   Waiting for path generation...")
        try:
            page.wait_for_selector('text=lessons', timeout=60000)
            audit_results["functional"]["path_generated"] = True
        except:
            audit_results["functional"]["path_generated"] = False
            
        page.screenshot(path='audit_space_detail_ready.png')
        
        # 6. Functional: Lesson/Learn
        print("6. Testing Learn Page...")
        page.locator('button:has-text("1")').first.click()
        page.wait_for_url('**/learn/*', timeout=10000)
        
        # Wait for content
        try:
            page.wait_for_selector('text=Conceptual Targets', timeout=60000)
            audit_results["functional"]["lesson_content_loaded"] = True
        except:
            audit_results["functional"]["lesson_content_loaded"] = False
            
        page.screenshot(path='audit_learn_page.png')
        
        # UX: Elements presence
        audit_results["functional"]["viz_present"] = page.locator('canvas').count() > 0 or page.locator('[class*="AnimationPlayer"]').count() > 0
        audit_results["functional"]["mentor_present"] = page.locator('text=AI Mentor').count() > 0
        
        browser.close()
        
    print("\nAudit Complete. Results:")
    print(audit_results)

if __name__ == "__main__":
    run_audit()
