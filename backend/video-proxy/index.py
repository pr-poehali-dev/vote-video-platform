'''
Business: Проксирование видео с Яндекс.Диска для корректного воспроизведения
Args: event - dict с httpMethod, queryStringParameters (url)
      context - объект с атрибутами request_id
Returns: HTTP response с видео-стримом или редирект
'''
import json
import os
from typing import Dict, Any
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Range',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        video_id_str = params.get('id', '')
        
        if not video_id_str:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Video ID required'})
            }
        
        try:
            video_id = int(video_id_str)
        except ValueError:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid video ID'})
            }
        
        database_url = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        cur.execute("SELECT video_url FROM videos WHERE id = %s", (video_id,))
        result = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Video not found'})
            }
        
        video_url = result[0]
        
        return {
            'statusCode': 302,
            'headers': {
                'Location': video_url,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            },
            'body': ''
        }
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'})
    }