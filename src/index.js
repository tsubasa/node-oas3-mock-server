const deepExtend = require('deep-extend');
const { send } = require('micro');
const { router, get } = require('microrouter');
const { loadYaml, getEndpoint, getFilePath, getIn, parseRef } = require('./utils');
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
    const schemas =
      getIn(doc, ['paths', endpoint, 'get', 'responses', 200, 'content', 'application/json', 'schema']) || {};

    // exampleを取得
    const examples =
      getIn(doc, ['paths', endpoint, 'get', 'responses', 200, 'content', 'application/json', 'example']) || {};

    return send(res, 200, deepExtend(sampleFromSchema(parseRef(schemas, doc)), parseRef(examples, doc)));
  } catch (e) {
    if (e) {
      return send(res, 500, e.toString());
    }
    return send(res, 404, 'Endpoint not found.');
  }
};

module.exports = router(get('/*', routing));
