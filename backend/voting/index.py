'''
Business: API для системы голосования между двумя видео с защитой от повторных голосов
Args: event - dict с httpMethod, body, queryStringParameters
      context - объект с атрибутами request_id, function_name
Returns: HTTP response dict с результатами голосования или статистикой
'''
import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Device-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Connect to database
    database_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    try:
        # GET - получить статистику голосования
        if method == 'GET':
            # Get voting statistics
            cur.execute("""
                SELECT id, title, description, youtube_url, thumbnail, video_url,
                       (SELECT COUNT(*) FROM votes WHERE video_choice = videos.id) as vote_count
                FROM videos
                ORDER BY id
            """)
            videos = cur.fetchall()
            
            result = {
                'videos': [
                    {
                        'id': v[0],
                        'title': v[1],
                        'description': v[2],
                        'youtube_url': v[3],
                        'thumbnail': v[4],
                        'video_url': v[5],
                        'vote_count': v[6]
                    }
                    for v in videos
                ],
                'total_votes': sum(v[6] for v in videos)
            }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps(result)
            }
        
        # POST - зарегистрировать голос
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            device_id: str = body_data.get('deviceId', '')
            video_choice: int = body_data.get('videoChoice', 0)
            
            if not device_id or video_choice not in [1, 2]:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Invalid request data'})
                }
            
            # Check if device already voted
            cur.execute("SELECT id FROM votes WHERE device_fingerprint = %s", (device_id,))
            existing_vote = cur.fetchone()
            
            if existing_vote:
                return {
                    'statusCode': 409,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Already voted', 'message': 'Вы уже проголосовали'})
                }
            
            # Register vote
            cur.execute(
                "INSERT INTO votes (device_fingerprint, video_choice) VALUES (%s, %s)",
                (device_id, video_choice)
            )
            conn.commit()
            
            # Get updated statistics
            cur.execute("""
                SELECT id, 
                       (SELECT COUNT(*) FROM votes WHERE video_choice = videos.id) as vote_count
                FROM videos
                ORDER BY id
            """)
            videos = cur.fetchall()
            
            result = {
                'success': True,
                'message': 'Голос принят!',
                'statistics': {
                    'videos': [{'id': v[0], 'vote_count': v[1]} for v in videos],
                    'total_votes': sum(v[1] for v in videos)
                }
            }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps(result)
            }
        
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        cur.close()
        conn.close()