import json
import boto3
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain.schema import AIMessage
import time

gateway_client = boto3.client('apigatewaymanagementapi', endpoint_url='https://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production')
        
def lambda_handler(event, context):
    # 연결 ID 가져오기
    connection_id = event['requestContext']['connectionId']
    
    # 웰컴 메시지
    time.sleep(0.5)
    welcome_message = "Welcome to chat AI"
    
    try:
        return {
            'statusCode': 200,
            'body': json.dumps('Connected and welcome message sent')
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error in connecting or sending message')
        }