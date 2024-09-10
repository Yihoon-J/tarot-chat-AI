import json
import boto3
import uuid
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('tarotchat_ddb')

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        user_id = body['userId']
        
        session_id, created_at, session_name = create_new_session(user_id)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'userId': user_id,
                'sessionId': session_id,
                'createdAt': created_at,
                'sessionName': session_name,
                'message': 'New session created successfully'
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }

def create_new_session(user_id):
    session_id = str(uuid.uuid4())
    current_time = datetime.now().isoformat()
    session_name = f"Chat Session {current_time}"
    
    item = {
        'UserId': user_id,  # Partition Key
        'SessionId': session_id,  # Sort Key
        'CreatedAt': current_time,
        'LastUpdatedAt': current_time,
        'SessionName': session_name,
        'History': json.dumps([])  # 빈 리스트를 JSON 문자열로 저장
    }
    
    # DynamoDB에 새 세션 항목 추가
    table.put_item(Item=item)
    
    return session_id, current_time, session_name