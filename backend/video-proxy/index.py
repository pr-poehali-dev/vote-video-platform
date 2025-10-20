'''
Business: Прокси для загрузки видео с Яндекс.Диска для воспроизведения в браузере
Args: event - dict с httpMethod, queryStringParameters (url)
      context - объект с атрибутами request_id
Returns: HTTP response с видео данными или редирект
'''
import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        video_id = params.get('id', '')
        
        video_urls = {
            '1': 'https://disk.yandex.ru/i/jvzaF36uOEXAYQ',
            '2': 'https://disk.yandex.ru/i/MduqiNnVit8s2Q'
        }
        
        if video_id not in video_urls:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid video ID'})
            }
        
        yandex_url = video_urls[video_id]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'url': yandex_url,
                'message': 'Откройте видео по ссылке в новой вкладке'
            })
        }
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'})
    }
