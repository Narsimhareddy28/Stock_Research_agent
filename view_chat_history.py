#!/usr/bin/env python3
"""
Simple script to view chat history from the SQLite database
"""

from database import db
import json
from datetime import datetime

def format_timestamp(timestamp_str):
    """Format timestamp for display"""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return timestamp_str

def view_sessions():
    """View all sessions"""
    print("📊 CHAT SESSIONS")
    print("=" * 60)
    
    sessions = db.get_all_sessions()
    if not sessions:
        print("No sessions found.")
        return
    
    for i, session in enumerate(sessions, 1):
        print(f"\n{i}. Session ID: {session['session_id']}")
        print(f"   Created: {format_timestamp(session['created_at'])}")
        print(f"   Last Updated: {format_timestamp(session['last_updated'])}")
        print(f"   Messages: {session['message_count']}")
        print("-" * 40)

def view_session_messages(session_id):
    """View messages for a specific session"""
    print(f"\n💬 MESSAGES FOR SESSION: {session_id}")
    print("=" * 60)
    
    messages = db.get_session_messages(session_id)
    if not messages:
        print("No messages found for this session.")
        return
    
    for i, message in enumerate(messages, 1):
        print(f"\n{i}. [{message['type'].upper()}] - {format_timestamp(message['timestamp'])}")
        print(f"   Content: {message['content'][:100]}{'...' if len(message['content']) > 100 else ''}")
        
        if message['sources']:
            print(f"   Sources: {len(message['sources'])} URLs")
            for j, source in enumerate(message['sources'][:3], 1):
                print(f"     {j}. {source}")
            if len(message['sources']) > 3:
                print(f"     ... and {len(message['sources']) - 3} more")
        
        if message['metadata']:
            print(f"   Metadata: {message['metadata']}")
        
        print("-" * 40)

def main():
    """Main function"""
    print("🗄️  CHAT HISTORY VIEWER")
    print("=" * 60)
    
    while True:
        print("\nOptions:")
        print("1. View all sessions")
        print("2. View messages for a session")
        print("3. Delete a session")
        print("4. Exit")
        
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == "1":
            view_sessions()
        
        elif choice == "2":
            session_id = input("Enter session ID: ").strip()
            if session_id:
                view_session_messages(session_id)
        
        elif choice == "3":
            session_id = input("Enter session ID to delete: ").strip()
            if session_id:
                success = db.delete_session(session_id)
                if success:
                    print(f"✅ Session {session_id} deleted successfully!")
                else:
                    print(f"❌ Failed to delete session {session_id}")
        
        elif choice == "4":
            print("👋 Goodbye!")
            break
        
        else:
            print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
