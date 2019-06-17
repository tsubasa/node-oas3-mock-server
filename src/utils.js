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
  const match = url.match(/^\/api\/(?:(admin)\/)?(\w+)/i);
  if (Array.isArray(match) && match.length === 3) {
    return match[1] ? `${match[1]}/${match[2]}` : match[2];
  }
  throw Error('URL Parse error.');
};

/**
 * URLからエンドポイントを取得する
 * @param {object} obj オブジェクトを指定
 * @param {string} url URLを指定
 */
const getEndpoint = (obj, url, method = '') => {
  if (typeof obj !== 'object') throw Error('Not object');
  if (!('paths' in obj)) throw Error('Not paths');
  const { paths } = obj;
  let endpoint;

  Object.keys(paths).some(value => {
    const pattern = `^${value.replace(/{\w+}/gi, '[\\w{}%]+')}$`;
    const re = new RegExp(pattern, 'i');
    const match = url.split('?')[0].match(re, value);
    if (match && match.length && method in paths[value]) {
      endpoint = value;
      return true;
    }
    return false;
  });

  if (!endpoint || !hasMethod(obj, endpoint, method)) {
    const endpoints = Object.keys(paths)
      .map(value => {
        return Object.keys(paths[value]).map(val => `${val.toUpperCase().padEnd(6)} ${value}`);
      })
      .reduce((arr, val) => arr.concat(val), []);
    throw Error(`Endpoint not found.\n\nThe list of available APIs:\n${endpoints.join('\n')}`);
  }

  return endpoint;
};

/**
 * schemaを取得
 * @param {object} obj OAS Object
 * @param {string} endpoint エンドポイント
 * @param {string} method メソッド [get, post, put]
 * @param {array} allowStatuses 許可するステータスコード
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
 * @param {object} obj OAS Object
 * @param {string} endpoint エンドポイント
 * @param {string} method メソッド [get, post, put]
 * @param {array} allowStatuses 許可するステータスコード
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
 * @param {object} obj OAS Object
 * @param {string} endpoint エンドポイント
 * @param {string} method メソッド [get, post, put]
 * @param {array} allowStatuses 許可するステータスコード
 */
const getStatusCode = (obj, endpoint, method, allowStatuses = [200, 201, 203, 204]) => {
  if (allowStatuses.length === 0) throw Error('Response status code not defined.');
  return (
    (getIn(obj, ['paths', endpoint, method, 'responses', allowStatuses[0]]) && allowStatuses[0]) ||
    getStatusCode(obj, endpoint, method, allowStatuses.slice(1))
  );
};

/**
 * メソッドの有無
 * @param {object} obj OAS Object
 * @param {string} endpoint エンドポイント
 * @param {string} method メソッド [get, post, put]
 */
const hasMethod = (obj, endpoint, method) => {
  return !!getIn(obj, ['paths', endpoint, method]);
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
 * @param {string} currentPath 作業ファイルのパスを指定
 */
const getRef = (obj, value = '', currentPath = '') => {
  const paths = value.split('#');

  if (paths.length === 2 && paths[0] && paths[1]) {
    const keyIn = paths[1].split('/');

    if (paths[1].indexOf('/') === 0) {
      keyIn.shift();
    }

    const resolveFilePath = path.resolve(
      `${process.cwd()}/${process.env.APIDOC_PATH}`,
      path.dirname(currentPath),
      paths[0]
    );

    // 外部ファイルを読み込む処理
    const doc = loadYaml(resolveFilePath);
    const exObj = replaceRefPath(doc, resolveFilePath);
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
 * @param {string} currentPath 作業ファイルのパスを指定
 */
const parseRef = (obj, raw = {}, currentPath = '') => {
  if (obj === null || typeof obj === 'undefined') return obj;

  if (Array.isArray(obj)) {
    return obj.map(value => {
      return parseRef(value, raw, currentPath);
    });
  }

  if (!Array.isArray(obj) && typeof obj === 'object') {
    Object.keys(obj).map(value => {
      if (value.toLowerCase() === 'allof') {
        let tmpObj = {};
        const res = parseRef(obj[value], raw, currentPath);

        if (Array.isArray(res)) {
          res.forEach(v => {
            tmpObj = deepExtend(tmpObj, v);
          });
        } else {
          tmpObj = res;
        }

        obj = tmpObj;
      } else if (value.toLowerCase() === 'oneof' || value.toLowerCase() === 'anyof') {
        obj[value] = parseRef(obj[value], raw, currentPath);
      } else if (value === '$ref') {
        obj = parseRef(getRef(raw, obj[value], currentPath), raw, currentPath);
      } else if (
        // 特殊パターンは除外
        value.toLowerCase() === 'not' ||
        value.toLowerCase() === 'discriminator'
      ) {
        delete obj[value];
      } else {
        obj[value] = parseRef(obj[value], raw, currentPath);
      }
    });
  }

  return obj;
};

/**
 * $refパスを置換する
 * @param {object} obj API Doc
 * @param {string} filePath ファイルパス
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
        obj[value] =
          // eslint-disable-next-line no-nested-ternary
          obj[value].indexOf('#/') === 0
            ? obj[value].replace('#/', `${filePath}#/`)
            : obj[value].indexOf('#/') !== -1
            ? `${path.resolve(path.dirname(filePath), obj[value].split('#')[0])}#${obj[value].split('#')[1]}`
            : obj[value];
      } else {
        obj[value] = replaceRefPath(obj[value], filePath);
      }
    });
  }

  return obj;
};

module.exports = { loadYaml, getFilePath, getEndpoint, getSchema, getExample, getStatusCode, parseRef };
