import boto3

# DynamoDB 리소스 생성
dynamodb = boto3.resource('dynamodb')

# 테이블 생성
table = dynamodb.create_table(
    TableName='tarotchat_ddb',  # 원하는 테이블 이름으로 변경 가능
    KeySchema=[
        {
            'AttributeName': 'SessionId',
            'KeyType': 'HASH'  # Partition key
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'SessionId',
            'AttributeType': 'S'  # String type
        }
    ],
    BillingMode='PAY_PER_REQUEST'  # On-demand capacity mode
)

# 테이블이 생성될 때까지 대기
table.meta.client.get_waiter('table_exists').wait(TableName='tarotchat_ddb')

# 테이블 정보 출력
print(f"Table status: {table.table_status}")