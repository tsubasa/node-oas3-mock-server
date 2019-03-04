const fs = require('fs');
const yaml = require('js-yaml');
const { send } = require('micro');
const { router, get } = require('microrouter');
const { getEndpoint, getFilePath, getIn, parseRef } = require('./utils');

const routing = (req, res) => {
  try {
    // 初期値
    const { url } = req;
    const path = getFilePath(url);

    // YAML読み込み
    const doc = yaml.safeLoad(fs.readFileSync(`${process.env.APIDOC_PATH}/${path}.yaml`, 'utf8'));

    // APIのエンドポイントを取得
    const endpoint = getEndpoint(doc, url);

    // exampleを取得
    const example = getIn(doc, ['paths', endpoint, 'get', 'responses', 200, 'content', 'application/json', 'example']);

    return send(res, 200, parseRef(example, doc));
  } catch (e) {
    if (e) {
      return send(res, 500, e.toString());
    }
    return send(res, 404, 'Endpoint not found.');
  }
};

module.exports = router(get('/*', routing));
