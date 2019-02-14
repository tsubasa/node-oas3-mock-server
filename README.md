# node-oas3-mock-server

OAS3.0(OpenAPI Specification 3.0)で定義されているYAMLファイルをロードしてAPIのモックサーバーを立てる

## 機能

- OAS3.0で定義されているYAMLファイルを読み込みモックサーバーを立てる
- GETのみ対応
- 定義参照対応 (`$ref: path/to/`)

## 補足

OAS3.0で記述されたYAMLファイルかつ各APIに`example`の項目が記述されている必要があります。

## 使い方

`package.json`の`APIDOC_PATH`をYAMLがあるディレクトリパスに変更

```json
{
  "scripts": {
    "start": "cross-env APIDOC_PATH=\"./examples\" micro -l tcp://localhost:8080 src"
  }
}
```

サーバー立ち上げ

```bash
$ yarn install
$ yarn start
```

## サンプル

```bash
$ curl -X GET http://localhost:8080/petstore/pets
[{"id":1,"name":"lovely","tag":"dog"},{"id":2,"name":"robert","tag":"dog"},{"id":3,"name":"orafu","tag":"dog"}]

$ curl -X GET http://localhost:8080/petstore/pets/1
{"id":1,"name":"lovely","tag":"dog"}
```
