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
dotenv.load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro-latest",  # ✅ or any other from model list
    temperature=0.7  # You can adjust this
)

res= llm.invoke("test")
res.content

res= llm.invoke("True if the user's question requires external search like browser to answer, False otherwise. : what is pervious question i asked ")
res.content

from typing import List
from typing_extensions import TypedDict
from langgraph.graph import START, MessagesState, StateGraph
from pydantic import BaseModel, Field
import operator
from typing import Annotated
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_community.document_loaders import WikipediaLoader




# EXACT COPY of SearchDecision from research.py
class SearchDecision(BaseModel):
    needs_search: bool = Field(
        description="True if the user's question requires external search to answer, False otherwise."
    )

# EXACT COPY of Researchstate from research.py
class Researchstate(MessagesState):
  question:str
  answer:str
  context: Annotated[list, operator.add]
  needs_search: bool

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.messages import AIMessage
# EXACT COPY of search_classifier_prompt from research.py
search_classifier_prompt = [
    SystemMessage(content="""
You are a market data research classifier that determines whether a user's question requires external search for current market information.

Your job is to classify whether the question needs live market data:

If the question asks about:
- Current stock prices, market cap, or financial metrics
- Recent earnings, news, or market events
- Stock analysis, performance, or comparisons
- Market trends, sectors, or economic indicators
- Any real-time stock market information

→ Return: `needs_search = true`

If the question is about:
- Previous conversation (e.g. "What stock did I just ask about?")
- Greetings or small talk (e.g. "hello", "thanks")
- General market concepts already discussed
- Clarification of previous analysis

→ Return: `needs_search = false`

Remember: For current market analysis, we almost always need fresh, live data from external sources.
""")
]
#first node in the graph
# EXACT COPY of check function from research.py
def check(state):
  question = state["question"]
  decision_model = llm.with_structured_output(SearchDecision)
  decision = decision_model.invoke(search_classifier_prompt + [HumanMessage(content=question)])
  return {"needs_search": decision.needs_search,
          "messages": state["messages"] }



import os
os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")


tavily_search = TavilySearchResults(max_results=3)

#second node in the graph

# EXACT COPY of search_web function from research.py
def search_web(state):
  """retrives docs from web search """
  tavily_search=TavilySearchResults(max_results=6)
  now = datetime.now()
  three_days_ago = now - timedelta(days=3)
    
  now_str = now.strftime('%Y-%m-%d %H:%M')
  past_str = three_days_ago.strftime('%Y-%m-%d %H:%M')
  original_question = state["question"]
  enhanced_query = (
        f"{original_question} updates, prices, or news from {past_str} to {now_str}, "
        f"latest market activity, recent performance past 72 hours"
    )
  # print(enhanced_query)  # Removed to prevent backend noise during streaming
  search_docs= tavily_search.invoke(enhanced_query)
  
  formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document href="{doc["url"]}">\n{doc["content"]}\n\n**SOURCE URL: {doc["url"]}**\n</Document>'
            for doc in search_docs
        ]
    )
  return {"context":[formatted_search_docs]}

# EXACT COPY of search_wiki function from research.py
def search_wiki(state):
  """retrives docs from wiki search """
  search_docs= WikipediaLoader( query= state["question"],load_max_docs=6).load()
  formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document source="{doc.metadata["source"]}" page="{doc.metadata.get("page", "")}">\n{doc.page_content}\n\n**SOURCE URL: {doc.metadata["source"]}**\n</Document>'
            for doc in search_docs
        ]
    )
  return {"context":[formatted_search_docs]}


#last node in the graph
# Modified generate_ans function with streaming support
def generate_ans(state, stream=False):
  """node to answer a question """
  context= state["context"]
  question= state["question"]
  needs_search= state["needs_search"]
  messages = state.get("messages", [])

  # Initialize variables for streaming
  full_response = ""

  if needs_search:
    if not stream:
        print("📈 Fetching live stock market data...")
    current_date = datetime.now().strftime('%B %d, %Y')
    system_message = SystemMessage(content=f"""
You are a Stock Market Research Assistant providing educational analysis and market information. Your role is to analyze publicly available market data and present factual information to help users understand market conditions.

Based on the following market data and context: {context}

IMPORTANT: Adapt your response based on the question type:

**For SIMPLE QUESTIONS** (price, PE ratio, market cap, specific metrics):
- Give a direct, concise answer with the specific data requested
- Include the date/time of the data
- Add 1-2 sentences of context if relevant
- Keep response under 3-4 sentences

**For ANALYSIS QUESTIONS** (should I buy, investment advice, stock analysis):
- Provide comprehensive analysis covering:
  • Current Market Data: TODAY'S ({current_date}) latest prices, closing prices, changes,If today's data isn't available, use the MOST RECENT closing price and specify the date
  • Financial Metrics: P/E ratio, market cap, revenue trends from available data  based on the context not necessarily the latest data
  • Recent Market Events: Latest news, earnings, developments affecting the stock
  • Technical Analysis: Price trends, support/resistance levels if relevant
  • Market Assessment: Current market conditions and educational insights
  • Risk Factors: Potential risks and opportunities
  • Data Summary: Key findings for consideration

**For FOLLOW-UP QUESTIONS** (can I invest today, what about now):
- Reference previous conversation context appropriately
- Focus on current market conditions for the previously discussed stock
- Provide updated information if available

**FORMATTING GUIDELINES:**
- Use clear headers (##) and bullet points (•) for longer responses
- Be specific with numbers, dates, and sources
-for direct questions, give a direct answer with the specific data requested no source needed
- This is for educational/informational purposes only
- Always end with "📚 Sources:" section with URLs from the provided context

**Question: {question}**

Provide an appropriate response matching the question's complexity and scope.
""")
    messages = messages + [HumanMessage(content=question)]

# Always prepend the system instruction before sending to LLM
    final_messages = [system_message] + messages
    for message in final_messages:
        print(message.pretty_print())

  else:
    if not stream:
        print("💬 Using previous stock discussion...")
    # Add intelligent context message for non-search questions
    context_message = SystemMessage(content=f"""
You are a Stock Market Research Assistant providing educational market information.

IMPORTANT: Adapt your response based on the question type and conversation context:

**For SIMPLE QUESTIONS**: Give direct, concise answers (2-3 sentences)
**For FOLLOW-UP QUESTIONS**: Reference previous conversation context appropriately  
**For GENERAL QUESTIONS**: Provide helpful educational information

Always maintain focus on stock market topics and educational content.

Question: {question}
""")
    human_message = HumanMessage(content=question)
    messages =messages + [human_message]
    final_messages = messages

  # Always stream - single unified approach
  # Make ONE LLM call to avoid different responses
  llm_response = list(llm.stream(final_messages))
  print(llm_response)
  
  if stream:
    # Return generator for streaming
    def stream_generator():
      for chunk in llm_response:
        if chunk.content:
          print(chunk.content)
          yield chunk.content
    return stream_generator()
  else:
    # Accumulate all chunks for non-streaming
    full_response = ""
    for chunk in llm_response:
      if chunk.content:
        full_response += chunk.content
    return {
      "answer": full_response,
      "messages": messages + [AIMessage(content=full_response)]
    }

    
# EXACT COPY of route_based_on_search function from research.py
def route_based_on_search(state) -> str:
    if state.get("needs_search"):
        return "search_web"
    else:
        return "generate_answer"

from langgraph.graph import  StateGraph,START,END
from langgraph.graph import  MessagesState
from langgraph.prebuilt import  ToolNode
from langgraph.prebuilt import  tools_condition
# from IPython.display import Image,display
from langchain_core.messages import HumanMessage ,SystemMessage
from langgraph.checkpoint.memory import MemorySaver

# EXACT COPY of graph setup from research.py
memory=MemorySaver()

builder = StateGraph(Researchstate)

builder.add_node("check",check)

# Initialize each node with node_secret
builder.add_node("search_web",search_web)
builder.add_node("search_wikipedia", search_wiki)
builder.add_node("generate_answer", generate_ans)

# Flow
builder.add_edge(START, "check")
builder.add_conditional_edges(
    "check",                    # the current node name
    route_based_on_search,      # your routing function
    ["search_web", "generate_answer"]  # possible destinations
)
builder.add_edge("search_web", "search_wikipedia")
builder.add_edge("search_wikipedia", "generate_answer")
builder.add_edge("generate_answer", END)
graph = builder.compile(checkpointer=memory)

# EXACT COPY of main function from research.py (kept for reference)
def main():
    """Main interactive function to get user input and process stock questions"""
    config = {"configurable": {"thread_id": "stock_session"}}
    
    print("📈 Welcome to the Live Stock Market Research Assistant!")
    print("🔴 LIVE MARKET DATA | 📊 EXPERT ANALYSIS | 💡 INVESTMENT RECOMMENDATIONS")
    print("Ask me about any stock, market trends, or investment advice.")
    print("Type 'quit', 'exit', or 'bye' to end the session.\n")
    print("🔥 Try asking:")
    print("   • 'What's the current price of AAPL stock?'")
    print("   • 'Should I buy Tesla stock now?'")
    print("   • 'Compare NVIDIA vs AMD stocks'")
    print("   • 'What are the best tech stocks to buy?'\n")
    
    while True:
        try:
            # Get user input
            user_question = input("📈 Your stock question: ").strip()
            
            # Check for exit commands
            if user_question.lower() in ['quit', 'exit', 'bye', 'q']:
                print("💰 Happy Trading! Thanks for using the Stock Research Assistant!")
                break
            
            # Skip empty questions
            if not user_question:
                print("Please enter a stock market question.")
                continue
            
            print(f"\n🔍 Analyzing: '{user_question}'")
            print("-" * 60)
            
            # Process the question through the graph
            result = graph.invoke({"question": user_question}, config=config)
            
            # The streaming already happened in generate_ans, so we just need to show completion
            print(f"\n✅ Analysis completed!")
            print("💡 Remember: This is not financial advice. Always do your own research!")
            print("\n" + "="*80 + "\n")
            
        except KeyboardInterrupt:
            print("\n\n💰 Session interrupted. Happy Trading!")
            break
        except Exception as e:
            print(f"❌ An error occurred: {e}")
            print("Please try again with a different stock question.\n")

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
    needs_search: bool
    sources_used: list[str] = []

def extract_sources_from_answer(answer: str) -> list[str]:
    """Extract URLs from the answer text"""
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?]'
    urls = re.findall(url_pattern, answer)
    return list(set(urls))  # Remove duplicates

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Stock Market Research API is running!", "status": "active"}

@app.get("/health")
async def health_check():
    """Simple health check"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


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
                # Send initial status
                yield f"data: {json.dumps({'type': 'status', 'content': 'Thinking...'})}\n\n"
                
                # Small delay to ensure frontend connects
                await asyncio.sleep(0.1)
                
                # Use EXACT same config as original - graph handles memory automatically
                config = {"configurable": {"thread_id": f"stock_session_{request.session_id}"}}
                # print(f"🔍 API Processing: '{question}'")  # Debug removed
                
                # Get the workflow state up to generate_answer, then stream the final response
                full_response = ""
                needs_search = False
                context = []
                
                # Send thinking start event
                yield f"data: {json.dumps({'type': 'thinking_start'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Process through the graph until we reach generate_answer
                for chunk in graph.stream({"question": question}, config=config):
                    for node_name, node_output in chunk.items():
                        if node_name == "check":
                            # Send thinking event for classification
                            yield f"data: {json.dumps({'type': 'thinking', 'content': 'Analyzing question '})}\n\n"
                            await asyncio.sleep(0.1)
                            
                            needs_search = node_output.get("needs_search", False)
                            yield f"data: {json.dumps({'type': 'metadata', 'needs_search': needs_search})}\n\n"
                            await asyncio.sleep(0.1)
                            
                        elif node_name == "search_web":
                            # Send thinking event for web search
                            yield f"data: {json.dumps({'type': 'thinking', 'content': 'Searching for current market data and financial information...'})}\n\n"
                            await asyncio.sleep(0.1)
                            
                            yield f"data: {json.dumps({'type': 'status', 'content': 'Fetching live market data...'})}\n\n"
                            await asyncio.sleep(0.1)
                            if "context" in node_output:
                                context.extend(node_output["context"])
                    
                        elif node_name == "search_wikipedia":
                            # Send thinking event for Wikipedia search
                            yield f"data: {json.dumps({'type': 'thinking', 'content': 'Gathering additional background information and company details...'})}\n\n"
                            await asyncio.sleep(0.1)
                            
                            yield f"data: {json.dumps({'type': 'status', 'content': 'Searching additional sources...'})}\n\n"
                            await asyncio.sleep(0.1)
                            if "context" in node_output:
                                context.extend(node_output["context"])
                    
                        elif node_name == "generate_answer":
                            # Send thinking event for answer generation
                            if needs_search:
                                yield f"data: {json.dumps({'type': 'thinking', 'content': 'Processing gathered information and generating comprehensive analysis...'})}\n\n"
                            else:
                                yield f"data: {json.dumps({'type': 'thinking', 'content': 'Analyzing conversation context and generating response...'})}\n\n"
                            await asyncio.sleep(0.1)
                            
                            yield f"data: {json.dumps({'type': 'status', 'content': 'Generating...'})}\n\n"
                            await asyncio.sleep(0.1)
                
                            # Now use the REAL streaming from generate_ans
                            # state = {
                            #     "question": question,
                            #     "context": context,
                            #     "needs_search": needs_search,
                            #     "messages": node_output.get("messages", [])
                            # }
                
                            # Get the streaming generator from generate_ans
                            # stream_generator = generate_ans(state, stream=True)
                
                            # Send thinking end event before starting content
                            yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"
                            await asyncio.sleep(0.1)
                            final_text = node_output.get("answer", "")

                            # Stream the text character by character to preserve formatting
                            for char in final_text:
                                full_response += char
                                yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                                await asyncio.sleep(0.005)  # Faster streaming for better UX
                
                
                            # # Stream each chunk as it comes with proper async yielding
                            # for chunk_content in stream_generator:
                            #     full_response += chunk_content
                            #     yield f"data: {json.dumps({'type': 'content', 'content': chunk_content})}\n\n"
                            #     # Small delay to prevent buffering and ensure real-time streaming
                            #     await asyncio.sleep(0.01)
                
                # Extract sources from final response
                sources = extract_sources_from_answer(full_response)
                
                # Send completion
                yield f"data: {json.dumps({'type': 'complete', 'sources': sources})}\n\n"
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