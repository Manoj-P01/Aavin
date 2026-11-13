// ─────────────────────────────────────────────────────────────────────────────
// Safe Mathematical Expression Parser & Evaluator
// Evaluates formulas with operators (+, -, *, /) and parenthesis without eval/new Function
// Throws explicit error if identifier is missing or undefined.
// ─────────────────────────────────────────────────────────────────────────────

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

class Tokenizer {
  private pos = 0;
  constructor(private input: string) {}

  nextToken(): Token {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }

    if (this.pos >= this.input.length) {
      return { type: 'EOF', value: '', pos: this.pos };
    }

    const ch = this.input[this.pos];
    const start = this.pos;

    if (ch === '+') { this.pos++; return { type: 'PLUS', value: '+', pos: start }; }
    if (ch === '-') { this.pos++; return { type: 'MINUS', value: '-', pos: start }; }
    if (ch === '*') { this.pos++; return { type: 'MULTIPLY', value: '*', pos: start }; }
    if (ch === '/') { this.pos++; return { type: 'DIVIDE', value: '/', pos: start }; }
    if (ch === '(') { this.pos++; return { type: 'LPAREN', value: '(', pos: start }; }
    if (ch === ')') { this.pos++; return { type: 'RPAREN', value: ')', pos: start }; }

    // Number (digits, dot)
    if (/[0-9]/.test(ch) || (ch === '.' && this.pos + 1 < this.input.length && /[0-9]/.test(this.input[this.pos + 1]))) {
      let num = '';
      while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
        num += this.input[this.pos];
        this.pos++;
      }
      return { type: 'NUMBER', value: num, pos: start };
    }

    // Identifier (letters, underscore, digits after first char, dots allowed e.g. sp_gr, fat_pct)
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (this.pos < this.input.length && /[a-zA-Z0-9_.]/.test(this.input[this.pos])) {
        id += this.input[this.pos];
        this.pos++;
      }
      return { type: 'IDENTIFIER', value: id, pos: start };
    }

    throw new Error(`Unexpected character '${ch}' at position ${this.pos} in formula "${this.input}"`);
  }
}

class Parser {
  private currentToken: Token;
  private tokenizer: Tokenizer;

  constructor(formula: string, private context: Record<string, number>) {
    this.tokenizer = new Tokenizer(formula);
    this.currentToken = this.tokenizer.nextToken();
  }

  private eat(type: TokenType) {
    if (this.currentToken.type === type) {
      this.currentToken = this.tokenizer.nextToken();
    } else {
      throw new Error(`Syntax error: expected ${type}, got ${this.currentToken.type} ('${this.currentToken.value}') at position ${this.currentToken.pos}`);
    }
  }

  // Factor := ('+' | '-') Factor | Primary
  private factor(): number {
    const token = this.currentToken;
    if (token.type === 'PLUS') {
      this.eat('PLUS');
      return this.factor();
    }
    if (token.type === 'MINUS') {
      this.eat('MINUS');
      return -this.factor();
    }
    return this.primary();
  }

  // Primary := NUMBER | IDENTIFIER | '(' Expr ')'
  private primary(): number {
    const token = this.currentToken;

    if (token.type === 'NUMBER') {
      this.eat('NUMBER');
      const val = parseFloat(token.value);
      if (isNaN(val)) throw new Error(`Invalid number '${token.value}' at position ${token.pos}`);
      return val;
    }

    if (token.type === 'IDENTIFIER') {
      this.eat('IDENTIFIER');
      const id = token.value;
      // Search context with exact or case-insensitive key
      let resolved: number | undefined = this.context[id];
      if (resolved === undefined) {
        const lower = id.toLowerCase();
        for (const [k, v] of Object.entries(this.context)) {
          if (k.toLowerCase() === lower) {
            resolved = v;
            break;
          }
        }
      }

      if (resolved === undefined || resolved === null || isNaN(resolved)) {
        throw new Error(`Formula evaluation error: Variable "${id}" is missing or undefined in row data.`);
      }
      return Number(resolved);
    }

    if (token.type === 'LPAREN') {
      this.eat('LPAREN');
      const val = this.expr();
      this.eat('RPAREN');
      return val;
    }

    throw new Error(`Unexpected token ${token.type} ('${token.value}') at position ${token.pos}`);
  }

  // Term := Factor (('*' | '/') Factor)*
  private term(): number {
    let result = this.factor();

    while (this.currentToken.type === 'MULTIPLY' || this.currentToken.type === 'DIVIDE') {
      const op = this.currentToken.type;
      this.eat(op);
      const right = this.factor();
      if (op === 'MULTIPLY') {
        result = result * right;
      } else {
        if (right === 0) {
          return 0; // Safe divide by zero returns 0
        }
        result = result / right;
      }
    }

    return result;
  }

  // Expr := Term (('+' | '-') Term)*
  public expr(): number {
    let result = this.term();

    while (this.currentToken.type === 'PLUS' || this.currentToken.type === 'MINUS') {
      const op = this.currentToken.type;
      this.eat(op);
      const right = this.term();
      if (op === 'PLUS') {
        result = result + right;
      } else {
        result = result - right;
      }
    }

    return result;
  }

  public parse(): number {
    const result = this.expr();
    if (this.currentToken.type !== 'EOF') {
      throw new Error(`Unexpected trailing input '${this.currentToken.value}' at position ${this.currentToken.pos}`);
    }
    return result;
  }
}

/**
 * Safely evaluates a mathematical formula expression using variables from context.
 * No eval() or new Function(). Throws if variable is undefined.
 */
export function evaluateFormula(formula: string, context: Record<string, number>): number {
  const trimmed = (formula || '').trim();
  if (!trimmed) return 0;
  // If formula starts with '=', strip it
  const clean = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
  if (!clean) return 0;

  const parser = new Parser(clean, context);
  return parser.parse();
}

