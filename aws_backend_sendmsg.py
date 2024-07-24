#wss://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production/
#{"action":"sendMessage","message":"Good to see you."}

import json
import boto3
from langchain_aws import ChatBedrock
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories.dynamodb import DynamoDBChatMessageHistory
from langchain.schema import HumanMessage, AIMessage

# API Gateway client
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
    connection_id = str(event['requestContext']['connectionId'])
    user_message = json.loads(event['body'])['message']
    
    # DynamoDB를 사용한 메모리 설정
    chat_memory = DynamoDBChatMessageHistory(
        table_name="tarotchat_ddb",
        session_id=connection_id,
    )
    
    memory = ConversationBufferMemory(
        chat_memory=chat_memory,
        return_messages=True
    )
    
    model = ChatBedrock(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        streaming=True,
        model_kwargs={
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,
            "temperature": 0.1
        }
    )
    
    try:
        # 이전 대화 내용 가져오기
        chat_history = memory.chat_memory.messages
        messages = [HumanMessage(content="You are a helpful assistant.")]
        messages.extend(chat_history)
        messages.append(HumanMessage(content=user_message))
        
        response = model.invoke(messages)
        full_response = ""
        
        # response가 generator인 경우 처리
        if hasattr(response, '__iter__'):
            for chunk in response:
                if isinstance(chunk, AIMessage):
                    content = chunk.content
                elif isinstance(chunk, dict) and 'content' in chunk:
                    content = chunk['content']
                else:
                    content = str(chunk)
                
                if content:
                    stream_to_connection(connection_id, content)
                    full_response += content
        else:
            # response가 단일 메시지인 경우
            full_response = response.content if hasattr(response, 'content') else str(response)
            stream_to_connection(connection_id, full_response)
        
        # 대화 내용 저장
        memory.chat_memory.add_user_message(user_message)
        memory.chat_memory.add_ai_message(full_response)

        # 스트리밍 완료 신호 전송
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "end"}).encode('utf-8')
        )
    except Exception as e:
        print(f"Error: {str(e)}")
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "error", "message": str(e)}).encode('utf-8')
        )
    
    return {'statusCode': 200}