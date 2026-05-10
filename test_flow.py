import sys
import time
import uuid
from playwright.sync_api import sync_playwright

def test_full_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Registration
        print("Registering...")
        page.goto("http://localhost:3000/register")
        username = f"testuser_{uuid.uuid4().hex[:8]}"
        email = f"{username}@example.com"
        page.fill("#email", email)
        page.fill("#username", username)
        page.fill("#password", "Password123!")
        page.click("button:has-text('Create Account')")

        # 2. Assessment - Wait for redirect
        print("Waiting for assessment...")
        page.wait_for_url("**/assessment", timeout=30000)

        # Paste code
        code = """
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n-1)
"""
        page.fill("textarea", code)
        page.click("button:has-text('Analyze My Code')")

        # Wait for quiz to be ready (polling)
        print("Analyzing code (this may take a minute)...")
        # Increase timeout for LLM analysis
        page.wait_for_selector("text=Question 1 of", timeout=120000)

        # Answer 10 questions
        for i in range(10):
            print(f"Answering question {i+1}...")
            # Wait for options to be available
            page.wait_for_selector("button.w-full.rounded-xl")
            options = page.locator("button.w-full.rounded-xl")
            options.first.click()
            
            # Wait for feedback and Next button
            page.wait_for_selector("button:has-text('Next Question'), button:has-text('See Results')")
            page.click("button:has-text('Next Question'), button:has-text('See Results')")

        # 3. Dashboard
        print("Waiting for dashboard...")
        page.wait_for_url("**/dashboard", timeout=60000)
        page.screenshot(path='dashboard.png')

        # 4. Select a lesson
        print("Selecting a space...")
        # Path generation should be done. Click on the first space.
        # It might be named after the code snippet summary or just "Space"
        # Let's wait for any SpaceCard button
        page.wait_for_selector("button.group.relative.w-full")
        page.locator("button.group.relative.w-full").first.click()
        
        # Wait for redirect to SpaceDetail
        print("Waiting for space detail...")
        page.wait_for_url("**/space/*", timeout=30000)
        
        # Click on the first lesson
        print("Selecting a lesson...")
        page.wait_for_selector("button.w-full.rounded-xl.border.border-slate-700")
        page.locator("button.w-full.rounded-xl.border.border-slate-700").first.click()
        
        # 5. Learn Page
        print("Entering Learn page...")
        page.wait_for_url("**/learn/*", timeout=30000)
        # Wait for content to load
        page.wait_for_selector("h1.text-sm.font-bold", timeout=30000)
        page.screenshot(path='learn_page.png')

        # Verify Vertical Visual Stack
        # AnimationPlayer at top
        if page.locator("canvas").count() > 0 or page.locator("div.mesh-gradient").count() > 0:
            print("Verified: Visual Hero section is visible.")
        
        # Chat on right
        chat = page.locator("text=AI Mentor")
        if chat.is_visible():
            print("Verified: Chat is visible.")

        # 6. Socratic Interaction
        print("Testing Socratic Interaction...")
        page.fill("textarea[placeholder='Ask a technical question...']", "What is the base case in this factorial function?")
        page.click("button .lucide-send, button:has(svg.lucide-send)")
        
        # Wait for response (look for the assistant message bubble)
        print("Waiting for mentor response...")
        # Assistant messages have 'bg-slate-800/60'
        page.wait_for_selector("div.bg-slate-800\/60", timeout=60000)
        page.screenshot(path='chat_response.png')
        
        # Check if response asks a question (Socratic)
        messages = page.locator("div.bg-slate-800\/60").all()
        last_response = messages[-1].inner_text()
        print(f"Mentor response snippet: {last_response[:100]}...")
        if "?" in last_response:
            print("Verified: Mentor responded with a question (Socratic).")
        else:
            print("Warning: Mentor response might not be Socratic. Check screenshot.")

        print("Full flow test completed successfully!")
        browser.close()

if __name__ == "__main__":
    try:
        test_full_flow()
    except Exception as e:
        print(f"Test failed: {e}")
        sys.exit(1)
