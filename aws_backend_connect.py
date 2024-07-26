import json
import boto3
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain.schema import AIMessage

gateway_client = boto3.client('apigatewaymanagementapi', endpoint_url='https://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production')

def stream_to_connection(connection_id, content):
    try:
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "stream", "content": content}).encode('utf-8')
        )
    except Exception as e:
        print(f"Error streaming: {str(e)}")
        
def lambda_handler(event, context):
    # 연결 ID 가져오기
    connection_id = event['requestContext']['connectionId']
    
    # 웰컴 메시지
    welcome_message = "Welcome to chat AI"
    
    try:
        # 클라이언트에게 메시지 전송
        stream_to_connection(connection_id, welcome_message)
        
        # DynamoDB에 메시지 저장
        history = DynamoDBChatMessageHistory(
            table_name="tarotchat_ddb",  # DynamoDB 테이블 이름
            session_id=connection_id
        )
        
        # AI 메시지로 저장
        history.add_message(AIMessage(content=welcome_message))
        
        # 스트리밍 완료 신호 전송
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "end"}).encode('utf-8')
        )
            
        return {
            'statusCode': 200
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error in connecting or sending message')
        }