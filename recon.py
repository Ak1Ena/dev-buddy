
from playwright.sync_api import sync_playwright
import time

def run_recon():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:3000')
        page.wait_for_load_state('networkidle')
        
        # Take a screenshot of the landing page
        page.screenshot(path='landing_page.png', full_page=True)
        
        # Log some info about the page
        print(f"Title: {page.title()}")
        
        # Find the Magic Paste editor or related buttons
        buttons = page.locator('button').all()
        print("Buttons found:")
        for i, btn in enumerate(buttons):
            print(f"{i}: {btn.text_content()} - {btn.get_attribute('class')}")
            
        textareas = page.locator('textarea').all()
        print("\nTextareas found:")
        for i, ta in enumerate(textareas):
            print(f"{i}: {ta.get_attribute('placeholder')}")

        # Check for specific text "Magic Paste" or "Visualize Logic"
        magic_paste = page.get_by_text("Magic Paste", exact=False)
        print(f"\n'Magic Paste' found: {magic_paste.count() > 0}")
        
        visualize_logic = page.get_by_role("button", { "name": "Visualize Logic" })
        print(f"'Visualize Logic' button found: {visualize_logic.count() > 0}")

        browser.close()

if __name__ == "__main__":
    run_recon()
