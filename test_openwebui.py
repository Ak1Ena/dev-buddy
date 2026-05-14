import asyncio
import os
from openai import AsyncOpenAI

async def main():
    base_url = "https://chatgen.scmc.cmu.ac.th/api"
    # We will try a few different API keys or no API key to see the server's response
    api_key = "dummy_key_to_test"
    
    print(f"Testing {base_url} with api_key={api_key}")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    
    try:
        response = await client.chat.completions.create(
            model="gpt-5",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10
        )
        print("Success:", response)
    except Exception as e:
        print("Error:", type(e).__name__, e)

if __name__ == "__main__":
    asyncio.run(main())
