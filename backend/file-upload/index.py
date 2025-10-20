'''
Business: Загрузка файлов в облачное хранилище S3
Args: event - dict с httpMethod, body (base64 encoded file)
      context - объект с атрибутами request_id, function_name
Returns: HTTP response dict с публичным URL загруженного файла
'''
import json
import os
import base64
import uuid
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'POST')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        file_base64: str = body_data.get('file', '')
        file_name: str = body_data.get('fileName', '')
        
        if not file_base64 or not file_name:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'file and fileName are required'})
            }
        
        # Decode base64 file
        file_data = base64.b64decode(file_base64.split(',')[1] if ',' in file_base64 else file_base64)
        
        # Generate unique filename
        file_extension = file_name.split('.')[-1] if '.' in file_name else 'mp4'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Save to temporary location
        temp_path = f"/tmp/{unique_filename}"
        with open(temp_path, 'wb') as f:
            f.write(file_data)
        
        # Generate CDN URL (files are automatically uploaded to S3)
        cdn_url = f"https://cdn.poehali.dev/files/{unique_filename}"
        
        # Upload to S3 using boto3
        import boto3
        
        s3_access_key = os.environ.get('S3_ACCESS_KEY')
        s3_secret_key = os.environ.get('S3_SECRET_KEY')
        s3_bucket = os.environ.get('S3_BUCKET', 'poehali-files')
        
        s3_client = boto3.client(
            's3',
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1'
        )
        
        # Upload file to S3
        with open(temp_path, 'rb') as f:
            s3_client.upload_fileobj(
                f,
                s3_bucket,
                f"files/{unique_filename}",
                ExtraArgs={'ACL': 'public-read'}
            )
        
        # Clean up temp file
        os.remove(temp_path)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'success': True,
                'url': cdn_url,
                'fileName': unique_filename
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
