import type { Rule } from 'eslint';

/**
 * カスタムESLintルール: チェーンメソッドの深さを制限する
 *
 * チェーンメソッドの深さが指定された値を超える場合に警告を出す。
 * 例: obj.method1().method2().method3() は3段階
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'チェーンメソッドの深さを制限する',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxDepth: {
            type: 'integer',
            minimum: 1,
            default: 3,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      chainTooDeep:
        'チェーンメソッドの深さが{{maxDepth}}を超えています（現在: {{currentDepth}}段階）。中間変数を使用して可読性を向上させてください。',
    },
  },
  create(context) {
    const maxDepth = (context.options[0] as { maxDepth?: number })?.maxDepth ?? 3;

    /**
     * チェーンメソッドの深さを計算する
     * @param node - チェックするノード
     * @param depth - 現在の深さ
     * @returns チェーンメソッドの深さ
     */
    function getChainDepth(node: any, depth = 0): number {
      if (!node) {
        return depth;
      }

      // MemberExpression の場合（obj.method）
      if (node.type === 'MemberExpression') {
        // object が CallExpression の場合（method().property）
        if (node.object?.type === 'CallExpression') {
          return getChainDepth(node.object.callee, depth + 1);
        }
        // object が MemberExpression の場合（obj.method.property）
        if (node.object?.type === 'MemberExpression') {
          return getChainDepth(node.object, depth + 1);
        }
        return depth + 1;
      }

      // CallExpression の場合（method()）
      if (node.type === 'CallExpression') {
        if (node.callee?.type === 'MemberExpression') {
          return getChainDepth(node.callee, depth);
        }
        return depth;
      }

      return depth;
    }

    return {
      CallExpression(node) {
        // チェーンメソッドかどうかを判定
        if (node.callee.type === 'MemberExpression') {
          const depth = getChainDepth(node.callee, 0);

          if (depth > maxDepth) {
            context.report({
              node,
              messageId: 'chainTooDeep',
              data: {
                maxDepth: maxDepth.toString(),
                currentDepth: depth.toString(),
              },
            });
          }
        }
      },
    };
  },
};

export default rule;

