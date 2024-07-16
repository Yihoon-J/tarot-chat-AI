# langchain에만 의존
# pip install langchain
# pip install streamlit
# pip install boto3
# pip install langchain-aws
# pip install langchain-memory
# install langchain-memory

import os
from langchain_aws import ChatBedrock
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

def bedrock_llm():
    llm = ChatBedrock(
        model_id="anthropic.claude-3-haiku-20240307-v1:0", #"anthropic.claude-3-sonnet-20240229-v1:0",
        model_kwargs={
            'temperature': 0.5,
        },
    )
    return llm

def conversation(text):
    conversation=ConversationChain(
        llm=bedrock_llm(),
        memory=ConversationBufferMemory()
    )
    response=conversation.predict(input=text)
    return response
