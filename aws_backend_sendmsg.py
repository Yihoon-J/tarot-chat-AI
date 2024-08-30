import json
import boto3
from langchain_aws import ChatBedrock
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories.dynamodb import DynamoDBChatMessageHistory
from langchain.schema import HumanMessage, AIMessage

gateway_client = boto3.client('apigatewaymanagementapi', endpoint_url='https://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('tarotchat_ddb')

def stream_to_connection(connection_id, content):
    try:
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "stream", "content": content}).encode('utf-8')
        )
    except Exception as e:
        print(f"Error streaming: {str(e)}")

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event['body'])
    user_message = body['message']
    user_id = body['userId']
    
    # 사용자의 최신 세션 ID 조회
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('UserId').eq(user_id),
        ScanIndexForward=False,
        Limit=1
    )
    session_id = response['Items'][0]['SessionId'] if response['Items'] else None
    
    if not session_id:
        raise ValueError("Session not found")
    
    # DynamoDB를 사용한 메모리 설정
    chat_memory = DynamoDBChatMessageHistory(
        table_name="tarotchat_ddb",
        session_id=f"{user_id}:{session_id}",
        primary_key_name="UserId",
        key={
            "UserId": user_id,
            "SessionId": session_id
        }
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
        chat_history = memory.chat_memory.messages
        messages = [HumanMessage(content="You are a helpful assistant.")]
        messages.extend(chat_history)
        messages.append(HumanMessage(content=user_message))
        
        response = model.invoke(messages)
        full_response = ""
        
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
            full_response = response.content if hasattr(response, 'content') else str(response)
            stream_to_connection(connection_id, full_response)
        
        memory.chat_memory.add_user_message(user_message)
        memory.chat_memory.add_ai_message(full_response)

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