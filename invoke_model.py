# 기본 질의응답 기능만 구현

import boto3
import json

bedrock_runtime=boto3.client('bedrock-runtime')

def invoke_model(input):
    modelId='anthropic.claude-3-haiku-20240307-v1:0'
    accept="application/json"
    contentType="application/json"
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1000,
        "messages": [
        {
            "role": "user",
            "content": [
            {
                "type": "text",
                "text": f"{input}"
            }
            ]
        }
        ]
    })
    response=bedrock_runtime.invoke_model(
        body=body, modelId=modelId, accept=accept, contentType=contentType
    )
    response_body=json.loads(response.get("body").read())
    ans=response_body.get("content")[0]['text']
    print(ans)
    return ans

question=input('INPUT: ')
invoke_model(input=question)