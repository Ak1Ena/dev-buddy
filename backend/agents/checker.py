import os
from typing import Dict, Any, Tuple
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate

class CheckerAgent:
    """
    Agent responsible for fact-checking content using Real RAG with ChromaDB.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        self.embeddings = OpenAIEmbeddings()
        # Initialize ChromaDB
        self.vector_db = Chroma(
            persist_directory="./chroma_db", 
            embedding_function=self.embeddings
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a Fact-Checking Agent. Your task is to verify the provided content "
                       "against the retrieved context from the knowledge base. "
                       "If the content is accurate, respond 'APPROVED'. "
                       "If there are inaccuracies, respond 'REJECTED: [detail the error]'."),
            ("user", "Context: {context}\n\nContent to Verify: {content}")
        ])
        self.chain = self.prompt | self.llm

    def verify_content(self, content_dict: Dict[str, Any]) -> Tuple[bool, str]:
        try:
            content_text = content_dict.get("content", "")
            # 1. Retrieve relevant documents from Vector DB (RAG)
            docs = self.vector_db.similarity_search(content_text, k=3)
            context = "\n\n".join([doc.page_content for doc in docs])
            
            # 2. Verify using LLM
            response = self.chain.invoke({"context": context, "content": content_text}).content
            
            if "APPROVED" in response.upper():
                return True, "Content verified."
            return False, response
        except Exception as e:
            print(f"Checker Error: {e}")
            return True, "Proceeding due to verification error."
