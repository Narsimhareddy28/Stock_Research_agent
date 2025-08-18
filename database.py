import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional
import os

class ChatDatabase:
    def __init__(self, db_path: str = "chat_history.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    message_count INTEGER DEFAULT 0
                )
            ''')
            
            # Create messages table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT,
                    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
                )
            ''')
            
            # Create sources table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT,
                    display_text TEXT,
                    FOREIGN KEY (message_id) REFERENCES messages (id)
                )
            ''')
            
            conn.commit()
    
    def create_session(self, session_id: str) -> bool:
        """Create a new chat session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO sessions (session_id, created_at, last_updated, message_count)
                    VALUES (?, ?, ?, ?)
                ''', (session_id, datetime.now(), datetime.now(), 0))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error creating session: {e}")
            return False
    
    def save_message(self, session_id: str, message_type: str, content: str, metadata: Optional[Dict] = None) -> Optional[int]:
        """Save a message to the database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Save the message
                cursor.execute('''
                    INSERT INTO messages (session_id, message_type, content, metadata)
                    VALUES (?, ?, ?, ?)
                ''', (session_id, message_type, content, json.dumps(metadata) if metadata else None))
                
                message_id = cursor.lastrowid
                
                # Update session message count and last_updated
                cursor.execute('''
                    UPDATE sessions 
                    SET message_count = message_count + 1, last_updated = ?
                    WHERE session_id = ?
                ''', (datetime.now(), session_id))
                
                conn.commit()
                return message_id
        except Exception as e:
            print(f"Error saving message: {e}")
            return None
    
    def save_sources(self, message_id: int, sources: List[Dict]) -> bool:
        """Save sources for a message"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                for source in sources:
                    cursor.execute('''
                        INSERT INTO sources (message_id, url, title, display_text)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        message_id,
                        source.get('url', ''),
                        source.get('title', ''),
                        source.get('display', '')
                    ))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving sources: {e}")
            return False
    
    def get_session_messages(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Get messages for a session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT m.id, m.message_type, m.content, m.timestamp, m.metadata,
                           GROUP_CONCAT(s.url) as sources
                    FROM messages m
                    LEFT JOIN sources s ON m.id = s.message_id
                    WHERE m.session_id = ?
                    GROUP BY m.id
                    ORDER BY m.timestamp ASC
                    LIMIT ?
                ''', (session_id, limit))
                
                messages = []
                for row in cursor.fetchall():
                    message = {
                        'id': row[0],
                        'type': row[1],
                        'content': row[2],
                        'timestamp': row[3],
                        'metadata': json.loads(row[4]) if row[4] else None,
                        'sources': row[5].split(',') if row[5] else []
                    }
                    messages.append(message)
                
                return messages
        except Exception as e:
            print(f"Error getting session messages: {e}")
            return []
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT session_id, created_at, last_updated, message_count
                    FROM sessions
                    WHERE session_id = ?
                ''', (session_id,))
                
                row = cursor.fetchone()
                if row:
                    return {
                        'session_id': row[0],
                        'created_at': row[1],
                        'last_updated': row[2],
                        'message_count': row[3]
                    }
                return None
        except Exception as e:
            print(f"Error getting session info: {e}")
            return None
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all its messages"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Delete sources first (due to foreign key constraint)
                cursor.execute('''
                    DELETE FROM sources 
                    WHERE message_id IN (
                        SELECT id FROM messages WHERE session_id = ?
                    )
                ''', (session_id,))
                
                # Delete messages
                cursor.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
                
                # Delete session
                cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting session: {e}")
            return False
    
    def get_all_sessions(self, limit: int = 100) -> List[Dict]:
        """Get all sessions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT session_id, created_at, last_updated, message_count
                    FROM sessions
                    ORDER BY last_updated DESC
                    LIMIT ?
                ''', (limit,))
                
                sessions = []
                for row in cursor.fetchall():
                    session = {
                        'session_id': row[0],
                        'created_at': row[1],
                        'last_updated': row[2],
                        'message_count': row[3]
                    }
                    sessions.append(session)
                
                return sessions
        except Exception as e:
            print(f"Error getting all sessions: {e}")
            return []

# Global database instance
db = ChatDatabase()
