# langchain에만 의존
# pip install langchain
# pip install streamlit
# pip install boto3
# pip install langchain-aws

import os
from langchain_aws import ChatBedrock

def bedrock_llm(input):
    llm = ChatBedrock(
        model_id="anthropic.claude-3-haiku-20240307-v1:0" #"anthropic.claude-3-sonnet-20240229-v1:0",
        model_kwargs={
            'temperature': 0.5,
        },
    )
    
    messages=[
        ("system","Just tell me what you know. answers should be in Korean."),("human",input)
    ]
    output = llm.invoke(messages)
    message=output.content
    chatid=output.id
    usage=output.usage_metadata['total_tokens']
    return message

question=input('INPUT: ')
bedrock_llm(input=question)


'''
OUTPUT FORMAT
content='1992년 올림픽은 스페인 바르셀로나에서 개최되었습니다. 이 대회는 7월 25일부터 8월 9일까지 열렸으며, 169개 국가에서 9,356명의 선수가 참가했습니다. 통일 독일이 처음으로 단일 팀으로 출전한 올림픽이기도 합니다. 바르셀로나 올림픽은 스포츠 외에도 문화 프로그램과 환경 보호 활동 등 다양한 행사로 기억되고 있습니다.'
additional_kwargs={'usage': {'prompt_tokens': 41,'completion_tokens': 188, 'total_tokens': 229},
                   'stop_reason': 'end_turn',
                   'model_id': 'anthropic.claude-3-sonnet-20240229-v1:0'}
response_metadata={'usage': {'prompt_tokens': 41, 'completion_tokens': 188, 'total_tokens': 229},
                   'stop_reason': 'end_turn',
                   'model_id': 'anthropic.claude-3-sonnet-20240229-v1:0'}
id='run-2b950838-92d6-47ff-89cb-1a7f29e5982b-0'
usage_metadata={'input_tokens': 41, 'output_tokens': 188, 'total_tokens': 229}
'''