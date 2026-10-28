import definitions from './data/simulation/causal-rules.json' with { type: 'json' };
import { METRICS, type Metric } from './types.ts';

export type Expression = number | string | readonly [string, ...Expression[]];
export type CausalModel = {
    signals: { id: string; expression: Expression }[];
    rules: {
        id: string;
        sources: string[];
        target: Metric;
        label: string;
        expression: Expression;
    }[];
};
export type CausalContext = Record<string, number>;

const CONTEXT_VARIABLES = [
    ...METRICS,
    'baseline.infrastructure',
    'baseline.economy',
    'baseline.politicalControl',
    'baseline.aiAcceptance',
    'serviceSupply',
    'previousServiceSupply',
    'infiltrationAllocation',
    'defenseAllocation',
    'networkIncoming',
    'foothold',
    'anyInfiltrationFunded',
    'research.science',
    'research.languages',
    'research.institutions',
    'unlock.decision',
    'unlock.networkControl',
    'bonus.spread',
    'bonus.decision',
    'bonus.stealth',
    'config.infiltrationSpeed',
    'config.spillover',
    'config.decisionSpeed',
    'config.counterGrowth',
    'config.awarenessDecay',
];

type Evaluator = (context: CausalContext) => number;

function compile(expression: Expression, variables: Set<string>): Evaluator {
    if (typeof expression === 'number') {
        if (!Number.isFinite(expression)) throw new Error('因果式の数値が不正です');
        return () => expression;
    }
    if (typeof expression === 'string') {
        if (!variables.has(expression))
            throw new Error(`因果式に未定義の変数があります: ${expression}`);
        return (context) => context[expression];
    }
    if (!Array.isArray(expression) || expression.length < 2)
        throw new Error('因果式は演算子と引数の配列で指定してください');
    const [operator, ...operands] = expression;
    const arity = (count: number) => {
        if (operands.length !== count) throw new Error(`${operator} には引数が ${count} 個必要です`);
    };
    if (operator === 'if') {
        arity(3);
        const condition = compile(operands[0], variables);
        const positive = compile(operands[1], variables);
        const negative = compile(operands[2], variables);
        return (context) => (condition(context) !== 0 ? positive(context) : negative(context));
    }
    const parts = operands.map((operand) => compile(operand, variables));
    if (operator === '+' || operator === '*' || operator === 'max' || operator === 'min') {
        if (parts.length < 2) throw new Error(`${operator} には引数が2個以上必要です`);
        if (operator === '+')
            return (context) => parts.reduce((sum, part) => sum + part(context), 0);
        if (operator === '*')
            return (context) => parts.reduce((product, part) => product * part(context), 1);
        if (operator === 'max')
            return (context) => Math.max(...parts.map((part) => part(context)));
        return (context) => Math.min(...parts.map((part) => part(context)));
    }
    if (operator === 'and' || operator === 'or') {
        if (parts.length < 2) throw new Error(`${operator} には引数が2個以上必要です`);
        return operator === 'and'
            ? (context) => Number(parts.every((part) => part(context) !== 0))
            : (context) => Number(parts.some((part) => part(context) !== 0));
    }
    if (operator === 'sqrt' || operator === 'not') {
        arity(1);
        return operator === 'sqrt'
            ? (context) => Math.sqrt(parts[0](context))
            : (context) => Number(parts[0](context) === 0);
    }
    arity(2);
    if (operator === '-') return (context) => parts[0](context) - parts[1](context);
    if (operator === '/') return (context) => parts[0](context) / parts[1](context);
    if (operator === '>') return (context) => Number(parts[0](context) > parts[1](context));
    if (operator === '>=') return (context) => Number(parts[0](context) >= parts[1](context));
    if (operator === '<') return (context) => Number(parts[0](context) < parts[1](context));
    if (operator === '<=') return (context) => Number(parts[0](context) <= parts[1](context));
    if (operator === '==') return (context) => Number(parts[0](context) === parts[1](context));
    throw new Error(`因果式に未対応の演算子があります: ${operator}`);
}

export function compileCausalModel(model: CausalModel) {
    const variables = new Set<string>(CONTEXT_VARIABLES);
    const ids = new Set<string>();
    const signals = model.signals.map((signal) => {
        if (ids.has(signal.id) || variables.has(signal.id))
            throw new Error(`因果式のIDが重複しています: ${signal.id}`);
        const evaluate = compile(signal.expression, variables);
        variables.add(signal.id);
        ids.add(signal.id);
        return { id: signal.id, evaluate };
    });
    const rules = model.rules.map((rule) => {
        if (ids.has(rule.id)) throw new Error(`因果式のIDが重複しています: ${rule.id}`);
        if (!METRICS.includes(rule.target))
            throw new Error(`因果式の対象指標が不正です: ${rule.target}`);
        for (const source of rule.sources)
            if (!variables.has(source)) throw new Error(`因果式に未定義の入力があります: ${source}`);
        ids.add(rule.id);
        return { ...rule, evaluate: compile(rule.expression, variables) };
    });
    return (context: CausalContext, add: (metric: Metric, delta: number, source: string) => void) => {
        const values = context;
        for (const signal of signals) {
            const value = signal.evaluate(values);
            if (!Number.isFinite(value))
                throw new Error(`因果式の計算結果が不正です: ${signal.id}`);
            values[signal.id] = value;
        }
        for (const rule of rules) {
            const delta = rule.evaluate(values);
            if (!Number.isFinite(delta))
                throw new Error(`因果式の計算結果が不正です: ${rule.id}`);
            add(rule.target, delta, rule.label);
        }
        return values;
    };
}

export const CAUSAL_MODEL = definitions as unknown as CausalModel;
export const evaluateCausalRules = compileCausalModel(CAUSAL_MODEL);
