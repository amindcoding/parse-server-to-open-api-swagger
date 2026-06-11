# parse-server-to-open-api-swagger
Schema Introspection Parse Server to Swagger Open API

## Installation
1. npm i -D parse-server-to-open-api-swagger
2. create new script on package.json, 
    ex: "docs:generate-parse-swagger": "parse-swagger --output ./docs/api.yaml --exclude-system"

***note: yml will be create on folder src/docs***

3. open terminal, run -> npm run generate:docs -- --server-url `{URL_OF_PARSE_API}` --app-id "PROD_ID" --master-key "PROD_MASTER_KEY"
note: required to add server url, app id, and master key

***example: URL_OF_PARSE_API='https://myparseapi.com/parse'***
