# 기본 백엔드 구조, aws lambda handler
# AWS_GW_ENDPOINT, prompt 정의 필요

import boto3
from langchain_aws import ChatBedrock
from langchain_core.callbacks import BaseCallbackHandler
from langchain.chains import ConversationChain
from langchain.memory import BufferMemory
from langchain_community.stores.message.dynamodb import DynamoDBChatMessageHistory
import os

# Event handler logic:
connection_id = event['requestContext']['connectionId']
api_gw_man_api_client = boto3.client('apigatewaymanagementapi', 
                                     region_name=os.environ['AWS_REGION'],
                                     endpoint_url=API_GW_ENDPOINT)

memory = BufferMemory(
    chat_memory=DynamoDBChatMessageHistory(
        table_name="conversationhistory",
        partition_key="id",
        session_id=connection_id,
    )
)

class StreamingCallbackHandler(BaseCallbackHandler):
    def on_llm_new_token(self, token: str, **kwargs):
        api_gw_man_api_client.post_to_connection(
            ConnectionId=connection_id,
            Data=token.encode('utf-8')
        )

model = ChatBedrock(
    model_id="anthropic.claude-3-haiku-20240307-v1:0",
    streaming=True,
    callbacks=[StreamingCallbackHandler()],
    model_kwargs={
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 3000,
        "temperature": 0.1
    }
)

chain = ConversationChain(llm=model, memory=memory)
res = chain.predict(input=f"\n\nHuman: {prompt} \n\nAssistant:")