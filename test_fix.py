
import asyncio
import sys
import os
from pathlib import Path

# Add project root to sys.path to allow imports from app
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root / 'backend'))

# Manually load .env variables for the test script
from dotenv import load_dotenv
dotenv_path = project_root / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Now we can import from the app
from app.services.llm.factory import get_llm_provider

async def main():
    print("--- Verifying LLM Provider Fix ---")
    try:
        # This will now instantiate our new OpenWebUIProvider
        llm = get_llm_provider()
        
        print(f"Provider '{llm.__class__.__name__}' initialized successfully.")
        print("Sending a test message to the server...")

        response = await llm.complete(
            messages=[{"role": "user", "content": "Hello, this is a test. Is this working?"}],
            system="You are a helpful assistant.",
            max_tokens=50
        )

        print("""--- TEST RESULT ---""")
        if response and response.strip():
            print("SUCCESS: Received a valid response from the server.")
            print(f"Response (first 50 chars): {response[:50]}...")
        else:
            print("WARNING: Received an empty response, but the API call succeeded without crashing.")

    except Exception as e:
        print("""--- TEST FAILED ---""")
        print(f"An error occurred: {type(e).__name__}: {e}")
        print("The fix was not successful. Please check the server logs and configuration.")

if __name__ == "__main__":
    # Set the LLM_PROVIDER and LLM_MODEL for this test run
    os.environ['LLM_PROVIDER'] = 'openwebui'
    os.environ['LLM_MODEL'] = 'gpt-5'
    asyncio.run(main())
