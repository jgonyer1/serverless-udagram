import { Serverless } from 'serverless/aws';

const serverlessConfiguration: Serverless = {
  service: {
    name: 'serverless-udagram-app'
  },
  frameworkVersion: '>=1.72.0',
  custom: {
    documentation:{
      models:[
        {
          name: 'GroupRequest',
          contentType: 'application/json',
          schema: '${file(models/create-group-request.json)}'
        }
      ]
    },
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true
    }
  },
  plugins: [
    'serverless-webpack',
    
    'serverless-aws-documentation'
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
    apiGateway: {
      minimumCompressionSize: 1024,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      GROUPS_TABLE: 'Groups-${self:provider.stage}',
      IMAGES_TABLE: 'Images-${self:provider.stage}',
      IMAGE_ID_INDEX: 'ImageIdIndex'
    },
    iamRoleStatements:[
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:GetItem'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.GROUPS_TABLE}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Query'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Query'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}/index/${self:provider.environment.IMAGE_ID_INDEX}'
      }
    ],
    stage: '${opt:stage, "dev"}',
    region: '${opt:region, "us-east-1"}'
  },
  functions: {
    GetGroups:{
      handler: 'src/lambda/http/getGroups.handler',
      events: [
        {
          http:{
            method: 'get',
            path: 'groups',
            cors: true            
          }
        }
      ]
    },
    CreateGroup:{
      handler: 'src/lambda/http/createGroup.handler',
      events: [
        {
          http:{
            method: 'post',
            path: 'groups',
            cors: true,
            request:{
              schema: {
                'application/json': '${file(models/create-group-request.json)}'
              }
            }
          }
        }
      ]
    },
    GetImage:{
      handler: 'src/lambda/http/getImage.handler',
      events:[
        {
          http: {
            method: 'get',
            path: 'images/{imageId}',
            cors: true
          }
        }
      ]
    }
  },
  resources:{
    Resources:{
      GroupsDynamoDBTable:{
        Type: 'AWS::DynamoDB::Table',
        Properties:{
          AttributeDefinitions:[
            {
              AttributeName: 'id',
              AttributeType: 'S'
            }
          ],
          KeySchema:[
            {
              AttributeName: 'id',
              KeyType: 'HASH'
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: '${self:provider.environment.GROUPS_TABLE}'
        }
      },
      ImagesDynamoDBTable:{
        Type: 'AWS::DynamoDB::Table',
        Properties:{
          AttributeDefinitions:[
            {
              AttributeName: 'groupId',
              AttributeType: 'S'
            },
            {
              AttributeName: 'timestamp',
              AttributeType: 'S'
            },
            {
              AttributeName: 'imageId',
              AttributeType: 'S'
            }
          ],
          KeySchema:[
            {
              AttributeName: 'groupId',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'timestamp',
              KeyType: 'RANGE'
            }
          ],
          GlobalSecondaryIndexes:[
            {
              IndexName: '${self:provider.environment.IMAGE_ID_INDEX}',
              KeySchema:[
                {
                  AttributeName: 'imageId',
                  KeyType: 'HASH'
                }
              ],
              Projection: {
                ProjectionType: 'ALL'
              }
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: '${self:provider.environment.IMAGES_TABLE}'
        }
      },
      RequestBodyValidator:{
        Type: "AWS::ApiGateway::RequestValidator",
        Properties:{
          Name: 'request-body-validator',
          RestApiId:{
            Ref: 'ApiGatewayRestApi'
          },
          ValidateRequestBody: true,
          ValidateRequestParameters: false
        }
      }
    }
  }
}

module.exports = serverlessConfiguration;
