/* eslint-disable no-param-reassign, array-callback-return, no-use-before-define */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const deepExtend = require('deep-extend');

/**
 * ファイルの存在確認
 * @param {string} filePath ファイルパス
 */
const isExistFile = filePath => {
  try {
    fs.statSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Yamlファイルを読み込む
 * @param {string} filePath ファイルパス
 */
const loadYaml = (filePath, encode = 'utf8') => {
  filePath = path.resolve(filePath.replace(/\.[^/.]+$/, ''));
  const exts = ['.yml', '.yaml'];
  let data;

  exts.some(ext => {
    if (isExistFile(`${filePath}${ext}`)) {
      data = yaml.safeLoad(fs.readFileSync(`${filePath}${ext}`, encode));
      return true;
    }
    return false;
  });

  if (!data) throw Error(`Failed to open file: ${filePath}[${exts.join('|')}]`);

  return data;
};

/**
 * ファイルパスを取得
 * @param {string} url URLを指定
 */
const getFilePath = url => {
  const match = url.match(/^\/api\/(?:(admin)\/)?(\w+)\/.+/i);
  if (Array.isArray(match) && match.length === 3) {
    return match[1] ? `${match[1]}/${match[2]}` : match[2];
  }
  throw Error('URL Parse error.');
};

/**
 * エンドポイントを取得する
 * @param {object} obj オブジェクトを指定
 * @param {string} url URLを指定
 */
const getEndpoint = (obj, url) => {
  if (typeof obj !== 'object') throw Error('Not object');
  if (!('paths' in obj)) throw Error('Not paths');
  const { paths } = obj;
  let endpoint;

  Object.keys(paths).forEach(value => {
    const pattern = `^${value.replace(/{\w+}/gi, '[\\w{}%]+')}$`;
    const re = new RegExp(pattern, 'i');
    const match = url.split('?')[0].match(re, value);
    if (match && match.length) {
      endpoint = value;
    }
  });

  if (!endpoint) {
    const endpoints = Object.keys(paths)
      .map(value => {
        return Object.keys(paths[value]).map(method => `${method.toUpperCase().padEnd(6)} ${value}`);
      })
      .reduce((arr, val) => arr.concat(val), []);
    throw Error(`Endpoint not found.\n\nThe list of available APIs:\n${endpoints.join('\n')}`);
  }

  return endpoint;
};

/**
 * schemaを取得
 * @param {*} obj OAS Object
 * @param {*} endpoint エンドポイント
 * @param {*} method メソッド [get, post, put]
 * @param {*} allowStatuses 許可するステータスコード
 */
const getSchema = (obj, endpoint, method, allowStatuses = [200, 201, 203, 204]) => {
  if (allowStatuses.length === 0) return {};
  return (
    getIn(obj, ['paths', endpoint, method, 'responses', allowStatuses[0], 'content', 'application/json', 'schema']) ||
    getSchema(obj, endpoint, method, allowStatuses.slice(1))
  );
};

/**
 * exampleを取得
 * @param {*} obj OAS Object
 * @param {*} endpoint エンドポイント
 * @param {*} method メソッド [get, post, put]
 * @param {*} allowStatuses 許可するステータスコード
 */
const getExample = (obj, endpoint, method, allowStatuses = [200, 201, 203, 204]) => {
  if (allowStatuses.length === 0) return {};
  return (
    getIn(obj, ['paths', endpoint, method, 'responses', allowStatuses[0], 'content', 'application/json', 'example']) ||
    getExample(obj, endpoint, method, allowStatuses.slice(1))
  );
};

/**
 * status codeを取得
 * @param {*} obj OAS Object
 * @param {*} endpoint エンドポイント
 * @param {*} method メソッド [get, post, put]
 * @param {*} allowStatuses 許可するステータスコード
 */
const getStatusCode = (obj, endpoint, method, allowStatuses = [200, 201, 203, 204]) => {
  if (allowStatuses.length === 0) return undefined;
  return (
    (getIn(obj, ['paths', endpoint, method, 'responses', allowStatuses[0]], 'content') && allowStatuses[0]) ||
    getStatusCode(obj, endpoint, method, allowStatuses.slice(1))
  );
};

/**
 * ネストされたオブジェクトから対象のデータを取得する
 * @param {object} obj objectを指定
 * @param {array} keys objectのキーを配列で指定
 */
const getIn = (obj, keys = []) => {
  try {
    if (keys.length === 0) return obj;
    return getIn(obj[keys[0]], keys.slice(1));
  } catch (e) {
    return undefined;
  }
};

/**
 * $refで指定されたパスからデータを取得
 * @param {object} obj オブジェクト
 * @param {string} value 参照先のパス
 */
const getRef = (obj, value = '') => {
  const paths = value.split('#');

  if (paths.length === 2 && paths[0] && paths[1]) {
    const keyIn = paths[1].split('/');

    if (paths[1].indexOf('/') === 0) {
      keyIn.shift();
    }

    // TODO: 相対パスや絶対パスの解決が必要
    const resolvePath = paths[0].replace(/^\.\.\//, '');

    // 外部ファイルを読み込む処理
    const doc = loadYaml(`${process.cwd()}/${process.env.APIDOC_PATH}/${resolvePath}`);
    const exObj = replaceRefPath(doc, resolvePath);
    return getIn(exObj, keyIn);
  }

  if ((paths.length === 2 && paths[1]) || (paths.length === 1 && paths[0])) {
    const keyPath = paths[0] || paths[1];
    const keyIn = keyPath.split('/');

    if (keyPath.indexOf('/') === 0) {
      keyIn.shift();
    }

    return getIn(obj, keyIn);
  }

  return undefined;
};

/**
 * $refでポインタ参照されているキーに参照先のデータを代入する
 * @param {object} obj オブジェクトを指定
 * @param {object} raw オブジェクトを指定
 */
const parseRef = (obj, raw = {}) => {
  if (obj === null || typeof obj === 'undefined') return obj;

  if (Array.isArray(obj)) {
    return obj.map(value => {
      return parseRef(value, raw);
    });
  }

  if (!Array.isArray(obj) && typeof obj === 'object') {
    Object.keys(obj).map(value => {
      if (value.toLowerCase() === 'allof') {
        let tmpObj = {};
        const res = parseRef(obj[value], raw);

        if (Array.isArray(res)) {
          res.forEach(v => {
            tmpObj = deepExtend(tmpObj, v);
          });
        } else {
          tmpObj = res;
        }

        obj = tmpObj;
      } else if (value.toLowerCase() === 'oneof') {
        const tmpArr = parseRef(obj[value], raw);
        obj = tmpArr[Math.floor(Math.random() * tmpArr.length)];
      } else if (value === '$ref') {
        obj = parseRef(getRef(raw, obj[value]), raw);
      } else if (
        // 特殊パターンは除外
        value.toLowerCase() === 'anyOf' ||
        value.toLowerCase() === 'not' ||
        value.toLowerCase() === 'discriminator'
      ) {
        delete obj[value];
      } else {
        obj[value] = parseRef(obj[value], raw);
      }
    });
  }

  return obj;
};

/**
 * $refパスを置換する
 * @param {} obj API Doc
 * @param {*} filePath ファイルパス
 */
const replaceRefPath = (obj, filePath = '') => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(value => {
      return replaceRefPath(value, filePath);
    });
  }

  if (!Array.isArray(obj) && typeof obj === 'object') {
    Object.keys(obj).map(value => {
      if (value === '$ref') {
        obj[value] = obj[value].indexOf('#/' === 0) ? obj[value].replace('#/', `${filePath}#/`) : obj[value];
      } else {
        obj[value] = replaceRefPath(obj[value], filePath);
      }
    });
  }

  return obj;
};

module.exports = { loadYaml, getFilePath, getEndpoint, getSchema, getExample, getStatusCode, parseRef };
