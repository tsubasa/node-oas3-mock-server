/* eslint-disable no-param-reassign, consistent-return */

/*
 * Author: SmartBear Software
 * Original source: https://github.com/swagger-api/swagger-ui
 * License: Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)
 */

function normalizeArray(arr) {
  if (Array.isArray(arr)) return arr;
  return [arr];
}

const primitives = {
  string: () => 'string',
  string_email: () => 'user@example.com',
  'string_date-time': () => new Date().toISOString(),
  string_date: () => new Date().toISOString().substring(0, 10),
  string_uuid: () => '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  string_hostname: () => 'example.com',
  string_ipv4: () => '198.51.100.42',
  string_ipv6: () => '2001:0db8:5b96:0000:0000:426f:8e17:642a',
  number: () => 0,
  number_float: () => 0.0,
  integer: () => 0,
  boolean: schema => (typeof schema.default === 'boolean' ? schema.default : true)
};

const primitive = schema => {
  const { type, format } = schema;

  const fn = primitives[`${type}_${format}`] || primitives[type];

  if (typeof fn === 'function') return fn(schema);

  return `Unknown Type: ${schema.type}`;
};

const sampleFromSchema = (schema = {}) => {
  const { example, properties, items } = schema;
  let { type } = schema;

  if (example !== undefined) {
    return example;
  }

  if (!type) {
    if (properties) {
      type = 'object';
    } else if (items) {
      type = 'array';
    } else {
      return;
    }
  }

  if (type === 'object') {
    const props = properties;
    const obj = {};
    Object.keys(props).forEach(name => {
      obj[name] = sampleFromSchema(props[name]);
    });
    return obj;
  }

  if (type === 'array') {
    if (Array.isArray(items.anyOf)) {
      return items.anyOf.map(i => sampleFromSchema(i));
    }

    if (Array.isArray(items.oneOf)) {
      return items.oneOf.map(i => sampleFromSchema(i));
    }

    return [sampleFromSchema(items)];
  }

  if (schema.enum) {
    if (schema.default) return schema.default;
    return normalizeArray(schema.enum)[0];
  }

  if (type === 'file') {
    return;
  }

  return primitive(schema);
};

const inferSchema = thing => {
  if (thing.schema) thing = thing.schema;

  if (thing.properties) {
    thing.type = 'object';
  }

  return thing; // Hopefully this will have something schema like in it... `type` for example
};

module.exports = { sampleFromSchema, inferSchema };
