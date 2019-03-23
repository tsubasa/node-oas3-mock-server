const deepExtend = require('deep-extend');
const { send } = require('micro');
const { router, get, post, put } = require('microrouter');
const { loadYaml, getEndpoint, getFilePath, getSchema, getExample, getStatusCode, parseRef } = require('./utils');
const { sampleFromSchema } = require('./swagger-utils');

const routing = (req, res) => {
  try {
    // 初期値
    const { url } = req;
    const path = getFilePath(url);

    // YAML読み込み
    const doc = loadYaml(`${process.env.APIDOC_PATH}/${path}`);

    // APIのエンドポイントを取得
    const endpoint = getEndpoint(doc, url);

    // schemasを取得
    const schemas = getSchema(doc, endpoint, req.method.toLowerCase());

    // exampleを取得
    const examples = getExample(doc, endpoint, req.method.toLowerCase());

    // statusを取得
    const statusCode = getStatusCode(doc, endpoint, req.method.toLowerCase());

    return send(res, statusCode, deepExtend(sampleFromSchema(parseRef(schemas, doc)), parseRef(examples, doc)));
  } catch (e) {
    if (e) {
      return send(res, 500, e.toString());
    }
    return send(res, 404, 'Endpoint not found.');
  }
};

module.exports = router(get('/*', routing), post('/*', routing), put('/*', routing));
