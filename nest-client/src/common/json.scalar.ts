import { GraphQLScalarType, valueFromASTUntyped } from 'graphql';

/**
 * Arbitrary JSON value, used for free-form data sent by external systems.
 */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Any JSON value (object, array, string, number, boolean or null)',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast, variables) => valueFromASTUntyped(ast, variables),
});
