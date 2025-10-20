'''
Business: Получение прямых ссылок для воспроизведения видео с Яндекс.Диска
Args: event - dict с httpMethod, queryStringParameters (id)
      context - объект с атрибутами request_id
Returns: HTTP response с прямой ссылкой на видео
'''
import json
import re
from typing import Dict, Any
import urllib.request
import urllib.parse

def get_direct_link(public_url: str) -> str:
    """Получает прямую ссылку для скачивания с Яндекс.Диска"""
    try:
        # Извлекаем hash из публичной ссылки
        if '/i/' in public_url:
            hash_key = public_url.split('/i/')[-1]
        elif '/d/' in public_url:
            hash_key = public_url.split('/d/')[-1]
        else:
            return ''
        
        # Яндекс.Диск API для получения информации о публичном файле
        api_url = f'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key={urllib.parse.quote(public_url)}'
        
        req = urllib.request.Request(api_url)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data.get('href', '')
    except Exception as e:
        # Если API не работает, формируем прямую ссылку вручную
        return f'https://downloader.disk.yandex.ru/disk/public/?public_key={urllib.parse.quote(public_url)}'

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
        direct_link = get_direct_link(yandex_url)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'url': direct_link if direct_link else yandex_url,
                'video_id': video_id
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