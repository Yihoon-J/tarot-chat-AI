import json
import boto3
from datetime import datetime
from langchain_aws import ChatBedrock
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

def parse_messages(history_data):
    messages = []
    for item in json.loads(history_data):
        if item['type'] == 'human':
            messages.append(HumanMessage(content=item['data']['content']))
        elif item['type'] == 'ai':
            messages.append(AIMessage(content=item['data']['content']))
    return messages

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event['body'])
    user_message = body['message']
    user_id = body['userId']
    session_id = body['sessionId']

    try:
        # 기존 항목 가져오기
        response = table.get_item(
            Key={
                'UserId': user_id,
                'SessionId': session_id
            }
        )
        
        if 'Item' not in response:
            raise Exception("Session not found")

        existing_item = response['Item']
        
        print(f"Existing item: {existing_item}")  # 디버깅 정보
        
        # History 파싱
        history_data = existing_item.get('History', '[]')
        existing_messages = parse_messages(history_data)
        
        print(f"Parsed messages: {existing_messages}")  # 디버깅 정보

        # 모델 설정
        model = ChatBedrock(
            model_id="anthropic.claude-3-haiku-20240307-v1:0",
            streaming=True,
            model_kwargs={
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 3000,
                "temperature": 0.1
            }
        )

        # 메시지 준비
        messages = [HumanMessage(content="You are a helpful assistant.")]
        messages.extend(existing_messages)
        messages.append(HumanMessage(content=user_message))

        print(f"Messages to be sent to model: {messages}")  # 디버깅 정보

        # 응답 생성
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

        # 현재 시간 가져오기
        current_time = datetime.now().isoformat()

        # 업데이트된 history 생성
        updated_history = json.dumps([
            {
                "type": "human" if isinstance(msg, HumanMessage) else "ai",
                "data": {"content": msg.content}
            } for msg in messages + [AIMessage(content=full_response)]
        ])

        # DynamoDB 항목 업데이트
        update_expression = "SET History = :history, LastUpdatedAt = :last_updated_at"
        expression_attribute_values = {
            ':history': updated_history,
            ':last_updated_at': current_time
        }

        table.update_item(
            Key={
                'UserId': user_id,
                'SessionId': session_id
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values
        )

        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "end"}).encode('utf-8')
        )
        
        return {'statusCode': 200}

    except Exception as e:
        print(f"Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        gateway_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps({"type": "error", "message": str(e)}).encode('utf-8')
        )
        return {'statusCode': 500}