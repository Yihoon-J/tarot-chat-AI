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
            messages.append(HumanMessage(content=item['content']))
        elif item['type'] == 'ai':
            messages.append(AIMessage(content=item['content']))
    return messages

def extract_content(response):
    print(f"extract_content input: {response}")
    if isinstance(response, str):
        return response
    elif isinstance(response, AIMessage):
        return response.content
    elif isinstance(response, dict):
        if 'content' in response:
            return response['content']
        elif 'response' in response:
            return response['response']
    elif isinstance(response, tuple):
        if len(response) > 1 and response[0] == 'content':
            return response[1]
    print(f"extract_content output: Unable to extract content")
    return ""

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event['body'])
    user_message = body['message']
    user_id = body['userId']
    session_id = body['sessionId']

    try:
        response = table.get_item(Key={'UserId': user_id, 'SessionId': session_id})
        
        if 'Item' not in response:
            raise Exception("Session not found")

        existing_item = response['Item']
        history_data = existing_item.get('History', '[]')
        existing_messages = parse_messages(history_data)

        model = ChatBedrock(
            model_id="anthropic.claude-3-haiku-20240307-v1:0",
            streaming=True,
            model_kwargs={
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 3000,
                "temperature": 0.1
            }
        )

        messages = [HumanMessage(content="You are a helpful assistant.")]
        messages.extend(existing_messages)
        messages.append(HumanMessage(content=user_message))

        response = model.invoke(messages)

        full_response = ""
        if hasattr(response, '__iter__'):
            for chunk in response:
                print(f"Response chunk: {chunk}")
                content = extract_content(chunk)
                print(f"Extracted content from chunk: {content}")
                if content and isinstance(content, str):
                    stream_to_connection(connection_id, content)
                    full_response += content
        else:
            full_response = extract_content(response)
            stream_to_connection(connection_id, full_response)


        current_time = datetime.now().isoformat()
        
        updated_history = json.dumps([
            {
                "type": "human" if isinstance(msg, HumanMessage) else "ai",
                "content": msg.content if isinstance(msg, HumanMessage) else full_response
            } for msg in messages + [AIMessage(content=full_response)]
        ])


        update_expression = "SET History = :history, LastUpdatedAt = :last_updated_at"
        expression_attribute_values = {
            ':history': updated_history,
            ':last_updated_at': current_time
        }

        table.update_item(
            Key={'UserId': user_id, 'SessionId': session_id},
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