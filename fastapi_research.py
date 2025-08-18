# -*- coding: utf-8 -*-
"""
Stock Market Research Assistant - FastAPI Version

Uses exact same code from research.py with FastAPI wrapper
"""

# Original imports from research.py - EXACT COPY
import os
import getpass
import dotenv
from datetime import datetime, timedelta
from typing import List
from typing_extensions import TypedDict
from langgraph.graph import START, MessagesState, StateGraph
from pydantic import BaseModel, Field
import operator
from typing import Annotated
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_community.document_loaders import WikipediaLoader
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.messages import AIMessage

dotenv.load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro-latest",  # ✅ or any other from model list
    temperature=0.7  # You can adjust this
)





import os
os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")


tavily_search = TavilySearchResults(max_results=3)

#second node in the graph

# EXACT COPY of search_web function from research.py adapted as a tool
@tool
def search_web(query: str) -> str:
  """Retrieve recent market data/news for a query using Tavily and return a formatted text block."""
  tavily = TavilySearchResults(max_results=6)
  now = datetime.now()
  three_days_ago = now - timedelta(days=3)
  now_str = now.strftime('%Y-%m-%d %H:%M')
  past_str = three_days_ago.strftime('%Y-%m-%d %H:%M')
  enhanced_query = (
    f"{query} updates, prices, or news from {past_str} to {now_str}, latest market activity, recent performance past 72 hours"
  )
  search_docs = tavily.invoke(enhanced_query)
  formatted_search_docs = "\n\n---\n\n".join(
    [
      f'<Document href="{doc["url"]}">\n{doc["content"]}\n\n**SOURCE URL: {doc["url"]}**\n</Document>'
      for doc in search_docs
    ]
  )
  return formatted_search_docs

# EXACT COPY of search_wiki function from research.py adapted as a tool
@tool
def search_wiki(query: str) -> str:
  """Retrieve background/company info from Wikipedia for a query and return a formatted text block."""
  search_docs = WikipediaLoader(query=query, load_max_docs=6).load()
  formatted_search_docs = "\n\n---\n\n".join(
    [
      f'<Document source="{doc.metadata["source"]}" page="{doc.metadata.get("page", "")}">\n{doc.page_content}\n\n**SOURCE URL: {doc.metadata["source"]}**\n</Document>'
      for doc in search_docs
    ]
  )
  return formatted_search_docs


#last node in the graph
# Modified generate_ans function with streaming support
def generate_ans(state, stream=False):
  """node to answer a question """
  messages = state.get("messages", [])
  llm_with_tools = llm.bind_tools([search_web, search_wiki])

  # Prepare system instruction and user message
  sys_msg = SystemMessage(content=(
    "You are a Stock Market Research Assistant. "
    "IMPORTANT: Adapt your response based on the question type: "
    ""
    "For SIMPLE QUESTIONS (founding year, basic facts): "
    "• Give direct, concise answers "
    "• Only provide the specific information requested "
    "• Keep responses under 2-3 sentences "
    ""
    "For ANALYSIS QUESTIONS (stock performance, investment advice, company overview): "
    "• Provide comprehensive analysis including: "
    "  - Company overview and business model "
    "  - Current stock price and market performance "
    "  - Financial metrics (P/E ratio, market cap, revenue trends) "
    "  - Recent news and earnings "
    "  - Stock price history and trends "
    "  - Investment outlook and risks "
    ""
    "Use the web search tool when you need current data or don't know the answer. "
    "If users ask about non-stock topics, remind them you're a stock research assistant. "
    "CRITICAL: NEVER include URLs or 'Sources:' sections in your response. "
    "The system will automatically extract and display sources separately."
  ))

  # Ensure the user's question is present exactly once as a HumanMessage
  if not any(getattr(m, "type", None) == "human" for m in messages):
    messages = messages + [HumanMessage(content=state.get("question", ""))]

  # Single model call; if it decides to use a tool, tools_condition will route
  result = llm_with_tools.invoke([sys_msg] + messages)
  


  # If the model requested tools, return only messages to continue the loop
  tool_calls = getattr(result, "tool_calls", None) or result.additional_kwargs.get("tool_calls") if hasattr(result, "additional_kwargs") else None
  if tool_calls:
    return {"messages": messages + [result]}

  # Final answer: attach to state so the API can stream it
  final_answer = getattr(result, "content", "") or getattr(result, "text", "")
  return {
    "messages": messages + [result],
    "answer": final_answer
  }




    


from langgraph.graph import  StateGraph,START,END
from langgraph.graph import  MessagesState
from langgraph.prebuilt import  ToolNode, tool_node
from langgraph.prebuilt import  tools_condition
# from IPython.display import Image,display
from langchain_core.messages import HumanMessage ,SystemMessage
from langgraph.checkpoint.memory import MemorySaver

# EXACT COPY of graph setup from research.py
memory=MemorySaver()

builder = StateGraph(MessagesState)

# builder.add_node("check",check)

# # Initialize each node with node_secret
# builder.add_node("search_web",search_web)
# builder.add_node("search_wikipedia", search_wiki)
builder.add_node("generate_answer", generate_ans)
builder.add_node("tools", ToolNode(tools=[search_web, search_wiki]))

# Flow
builder.add_edge(START, "generate_answer")
builder.add_conditional_edges(
    "generate_answer",
    tools_condition,
)
builder.add_edge("tools", "generate_answer")
graph = builder.compile(checkpointer=memory)



# ===============================================
# FastAPI WRAPPER - NEW CODE ONLY
# ===============================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as FastAPIBaseModel
import re
import json
import asyncio
from database import db

# Initialize FastAPI app
app = FastAPI(title="Stock Market Research API", version="1.0.0")

# Add CORS middleware to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000" , "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI Pydantic models
class QuestionRequest(FastAPIBaseModel):
    question: str
    session_id: str = "default_session"  # Add session_id for unique memory per user
    # conversation_context removed - graph handles memory automatically with MemorySaver

class StockAnalysisResponse(FastAPIBaseModel):
    question: str
    answer: str
    sources_used: list[str] = []

def extract_sources_from_answer(answer: str) -> list[str]:
    """Extract URLs from the answer text"""
    try:
        # Multiple patterns to catch different URL formats
        patterns = [
            r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?]',  # Standard URLs
            r'SOURCE URL: (https?://[^\s]+)',  # URLs after "SOURCE URL:"
            r'\*\*SOURCE URL: (https?://[^\s]+)\*\*',  # URLs in markdown format (escaped asterisks)
            r'<Document href="(https?://[^"]+)"',  # URLs in Document tags
            r'<Document source="(https?://[^"]+)"',  # URLs in Document source tags
        ]
        
        urls = []
        for pattern in patterns:
            try:
                matches = re.findall(pattern, answer, re.IGNORECASE)
                for match in matches:
                    # Clean up the URL
                    url = match.strip()
                    # Remove trailing punctuation
                    url = url.rstrip('.,;:!?')
                    # Ensure it's a valid URL
                    if url.startswith('http://') or url.startswith('https://'):
                        urls.append(url)
            except Exception as e:
                continue
        
        return list(set(urls))  # Remove duplicates
    except Exception as e:
        return []

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Stock Market Research API is running!", "status": "active"}

@app.get("/health")
async def health_check():
    """Simple health check"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/sessions")
async def get_sessions():
    """Get all chat sessions"""
    sessions = db.get_all_sessions()
    return {"sessions": sessions}

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get messages for a specific session"""
    messages = db.get_session_messages(session_id)
    session_info = db.get_session_info(session_id)
    return {
        "session_info": session_info,
        "messages": messages
    }

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    success = db.delete_session(session_id)
    if success:
        return {"message": "Session deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@app.post("/analyze/stream")
async def analyze_stock_stream(request: QuestionRequest):
    """
    Streaming endpoint that sends analysis chunks as they're generated using graph.stream()
    """
    try:
        question = request.question.strip()
        
        if not question:
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        # Check user token limit before processing
     
        
        async def generate_stream():
            try:
                # Create or update session in database
                db.create_session(request.session_id)
                
                # Save user message to database
                user_message_id = db.save_message(
                    request.session_id, 
                    "user", 
                    question
                )
                
                # Send initial status
                yield f"data: {json.dumps({'type': 'status', 'content': 'Thinking...'})}\n\n"
                # Small delay to ensure frontend connects
                await asyncio.sleep(0.1)
                
                # Use EXACT same config as original - graph handles memory automatically
                config = {"configurable": {"thread_id": f"stock_session_{request.session_id}"}}
                # print(f"🔍 API Processing: '{question}'")  # Debug removed
                
                # Initialize response tracking
                full_response = ""
                
                # Send thinking start event
                yield f"data: {json.dumps({'type': 'thinking_start'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Use graph.invoke to get the final result
                result = graph.invoke({"messages": [HumanMessage(content=question)]}, config=config)
                
                # Send thinking end event before starting content
                yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Extract the final answer (always get the last AI message)
                messages = result.get("messages", [])
                final_text = ""
                
                # Get the last AI message (which should be the final response after tools)
                for m in reversed(messages):
                    if getattr(m, "type", None) == "ai":
                        final_text = getattr(m, "content", "")
                        break
                
                # Stream the final text character by character
                if final_text:
                    for char in final_text:
                        full_response += char
                        yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                        await asyncio.sleep(0.005)
                
                # Extract sources from the most recent tool message only
                sources = []
                messages = result.get("messages", [])
                
                # Find the most recent tool message
                tool_messages = []
                for i, msg in enumerate(messages):
                    if getattr(msg, 'type', '') == 'tool':
                        tool_messages.append((i, msg))
                
                if tool_messages:
                    # Use the most recent tool message
                    latest_tool_index, latest_tool_msg = tool_messages[-1]
                    
                    if hasattr(latest_tool_msg, 'content') and latest_tool_msg.content:
                        content_str = str(latest_tool_msg.content)
                        tool_sources = extract_sources_from_answer(content_str)
                        if tool_sources:
                            sources.extend(tool_sources)
                
                # Remove duplicates and filter out empty strings
                sources = list(set([s for s in sources if s and s.strip()]))
                
                # Clean up URLs (remove ** and other formatting artifacts)
                cleaned_sources = []
                for source in sources:
                    # Remove ** from the end of URLs
                    clean_url = source.rstrip('*').rstrip('*')
                    
                    # Validate URL format
                    if clean_url.startswith('http://') or clean_url.startswith('https://'):
                        if clean_url not in cleaned_sources:
                            cleaned_sources.append(clean_url)
                
                sources = cleaned_sources
                
                # Send completion with formatted sources
                formatted_sources = []
                for i, source in enumerate(sources, 1):
                    # Extract domain name for display
                    domain = source.replace('https://', '').replace('http://', '').split('/')[0]
                    formatted_sources.append({
                        "id": i,
                        "url": source,
                        "title": domain,
                        "display": f"Source {i}: {domain}"
                    })
                
                # Save AI response to database
                ai_message_id = db.save_message(
                    request.session_id,
                    "ai",
                    final_text,
                    {"needs_search": len(sources) > 0}
                )
                
                # Save sources to database if any
                if formatted_sources and ai_message_id:
                    db.save_sources(ai_message_id, formatted_sources)
                
                yield f"data: {json.dumps({'type': 'complete', 'sources': formatted_sources})}\n\n"
                await asyncio.sleep(0.1)
                
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
                "Access-Control-Allow-Origin": "*",
            }
        )
        
    except Exception as e:
        # print(f"❌ An error occurred: {e}")  # Removed to prevent backend noise
        raise HTTPException(status_code=500, detail=f"Streaming analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 