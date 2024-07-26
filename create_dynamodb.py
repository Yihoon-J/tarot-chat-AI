import json
import boto3
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain.schema import AIMessage
import time

def lambda_handler(event, context):
    # 연결 ID 가져오기
    connection_id = str(event['requestContext']['connectionId'])
    
    # API Gateway 클라이언트 생성
    gateway_client = boto3.client('apigatewaymanagementapi', endpoint_url='https://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production')

    
    # 웰컴 메시지
    welcome_message = "Welcome to chat AI"
    
    # try:
    # 클라이언트에게 메시지 전송
    time.sleep(0.5)
    gateway_client.get_connection(ConnectionId=connection_id)
    gateway_client.post_to_connection(
        ConnectionId=connection_id,
        Data=json.dumps({"type": "stream", "content": welcome_message}).encode('utf-8')
    )
    
    # DynamoDB에 메시지 저장
    history = DynamoDBChatMessageHistory(
        table_name="tarotchat_ddb",
        session_id=connection_id
    )
    
    # AI 메시지로 저장 (시스템 메시지 대신)
    history.add_message(AIMessage(content=welcome_message))
    
    return {
        'statusCode': 200,
        'body': json.dumps('Connected and welcome message sent')
    }
    # except Exception as e:
    #     print(f"Error: {str(e)}")
    #     return {
    #         'statusCode': 500,
    #         'body': json.dumps('Error in connecting or sending message')
    #     }