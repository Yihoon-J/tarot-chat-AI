import boto3

# boto3 DynamoDB 리소스 정의
dynamodb = boto3.resource('dynamodb')

# 테이블 생성
table = dynamodb.create_table(
    TableName='tarotchat_ddb',  # 테이블 이름
    KeySchema=[
        {
            'AttributeName': 'SessionId',
            'KeyType': 'HASH'  # 파티션키로 지정
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'SessionId',
            'AttributeType': 'S'  #자료형=string
        }
    ],
    BillingMode='PAY_PER_REQUEST'  #개발 단계에서는 사용량 온디맨드 처리하였음
)

# 테이블이 생성될 때까지 대기
table.meta.client.get_waiter('table_exists').wait(TableName='tarotchat_ddb')

# 테이블이 생성되면 정보 출력
print(f"Table status: {table.table_status}")