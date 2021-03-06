const deepExtend = require('deep-extend');
const { send } = require('micro');
const { router, get, post, put, del } = require('microrouter');
const { loadYaml, getEndpoint, getFilePath, getSchema, getExample, getStatusCode, parseRef } = require('./utils');
const { sampleFromSchema } = require('./swagger-utils');

const routing = (req, res) => {
  try {
    // 初期値
    const { url } = req;
    const filePath = getFilePath(url);

    // YAML読み込み
    const doc = loadYaml(`${process.env.APIDOC_PATH}/${filePath}`);

    // APIのエンドポイントを取得
    const endpoint = getEndpoint(doc, url, req.method.toLowerCase());

    // schemasを取得
    const schemas = getSchema(doc, endpoint, req.method.toLowerCase());

    // examplesを取得
    const examples = getExample(doc, endpoint, req.method.toLowerCase());

    // statusを取得
    const statusCode = getStatusCode(doc, endpoint, req.method.toLowerCase());

    return send(
      res,
      statusCode,
      deepExtend(
        Object.keys(schemas).length ? sampleFromSchema(parseRef(schemas, doc, filePath)) : {},
        Object.keys(examples).length ? parseRef(examples, doc, filePath) : {}
      )
    );
  } catch (e) {
    if (e) {
      return send(res, 500, e.toString());
    }
    return send(res, 404, 'Endpoint not found.');
  }
};

module.exports = router(get('/*', routing), post('/*', routing), put('/*', routing), del('/*', routing));
