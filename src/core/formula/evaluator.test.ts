import {describe, it, expect} from 'vitest'
import {evaluate, evaluateCell} from '@core/formula/evaluator'
import type {FormulaContext} from '@core/formula/evaluator'
import {parseRef, refToId, colToLetters, expandRange} from '@core/formula/cellRef'

function ctx(data: Record<string, string>): FormulaContext {
  return {getRaw: id => data[id]}
}
const empty = ctx({})

describe('cellRef', () => {
  it('parseRef переводит ссылку в row:col (0-based)', () => {
    expect(parseRef('A1')).toEqual({row: 0, col: 0})
    expect(parseRef('B3')).toEqual({row: 2, col: 1})
    expect(parseRef('Z1')).toEqual({row: 0, col: 25})
    expect(parseRef('AA1')).toEqual({row: 0, col: 26})
  })

  it('невалидные ссылки -> null', () => {
    expect(parseRef('A0')).toBeNull()
    expect(parseRef('ZZ')).toBeNull()
    expect(parseRef('1A')).toBeNull()
  })

  it('colToLetters обратно к буквам', () => {
    expect(colToLetters(0)).toBe('A')
    expect(colToLetters(25)).toBe('Z')
    expect(colToLetters(26)).toBe('AA')
  })

  it('refToId и expandRange', () => {
    expect(refToId('A1')).toBe('0:0')
    expect(expandRange('A1', 'B2')).toEqual(['0:0', '0:1', '1:0', '1:1'])
    // порядок не важен по сути, но проверим состав для обратного диапазона
    expect(expandRange('B2', 'A1').sort()).toEqual(['0:0', '0:1', '1:0', '1:1'])
  })
})

describe('evaluate — арифметика', () => {
  it('базовые операции и приоритеты', () => {
    expect(evaluate('2+2', empty)).toBe(4)
    expect(evaluate('2*3+1', empty)).toBe(7)
    expect(evaluate('1+2*3', empty)).toBe(7)
    expect(evaluate('(2+3)*4', empty)).toBe(20)
    expect(evaluate('10/4', empty)).toBe(2.5)
    expect(evaluate('-5+3', empty)).toBe(-2)
    expect(evaluate('2 + 2 * 2', empty)).toBe(6)
  })
})

describe('evaluate — ссылки и функции', () => {
  const data = {
    '0:0': '5', // A1
    '0:1': '10', // B1
    '0:2': '15', // C1
    '1:0': '2' // A2
  }
  const c = ctx(data)

  it('ссылки на ячейки', () => {
    expect(evaluate('A1+B1', c)).toBe(15)
    expect(evaluate('A1*A2', c)).toBe(10)
    expect(evaluate('C1-A1', c)).toBe(10)
  })

  it('SUM/AVG/MIN/MAX/COUNT с диапазоном', () => {
    expect(evaluate('SUM(A1:C1)', c)).toBe(30)
    expect(evaluate('AVG(A1:C1)', c)).toBe(10)
    expect(evaluate('MIN(A1:C1)', c)).toBe(5)
    expect(evaluate('MAX(A1:C1)', c)).toBe(15)
    expect(evaluate('COUNT(A1:C1)', c)).toBe(3)
  })

  it('функции со смешанными аргументами и вложенностью', () => {
    expect(evaluate('SUM(A1:C1, 100)', c)).toBe(130)
    expect(evaluate('SUM(A1:B1)*2', c)).toBe(30)
    expect(evaluate('MAX(A1, B1, 7)', c)).toBe(10)
  })

  it('пустые ячейки считаются как 0', () => {
    expect(evaluate('A1+Z5', c)).toBe(5)
  })
})

describe('evaluateCell — отображаемое значение', () => {
  it('обычный текст возвращается как есть', () => {
    expect(evaluateCell('0:0', ctx({'0:0': 'привет'}))).toBe('привет')
  })

  it('формула вычисляется', () => {
    const c = ctx({'0:0': '5', '0:1': '=A1+10'})
    expect(evaluateCell('0:1', c)).toBe('15')
  })

  it('вложенные формулы', () => {
    // A1 = 2, B1 = =A1+3, C1 = =B1*2  -> 10
    const c = ctx({'0:0': '2', '0:1': '=A1+3', '0:2': '=B1*2'})
    expect(evaluateCell('0:2', c)).toBe('10')
  })

  it('пустая формула "=" не даёт undefined, а пусто', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '='}))).toBe('')
  })

  it('деление на ноль -> #DIV/0!', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=1/0'}))).toBe('#DIV/0!')
  })

  it('самоссылка -> #CIRC!', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=A1'}))).toBe('#CIRC!')
  })

  it('взаимная циклическая ссылка -> #CIRC!', () => {
    const c = ctx({'0:0': '=B1', '0:1': '=A1'})
    expect(evaluateCell('0:0', c)).toBe('#CIRC!')
  })

  it('неизвестная функция -> #NAME?', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=FOO(1)'}))).toBe('#NAME?')
  })

  it('кривой синтаксис -> #ERROR!', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=2+'}))).toBe('#ERROR!')
  })

  it('убирает артефакты плавающей точки', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=0.1+0.2'}))).toBe('0.3')
  })
})

describe('операторы (сравнение, &, ^, %)', () => {
  it('сравнения возвращают boolean', () => {
    expect(evaluate('2>1', empty)).toBe(true)
    expect(evaluate('1=1', empty)).toBe(true)
    expect(evaluate('1<>2', empty)).toBe(true)
    expect(evaluate('3<=2', empty)).toBe(false)
    expect(evaluate('"abc"="abc"', empty)).toBe(true)
  })

  it('конкатенация &', () => {
    expect(evaluate('"a"&"b"&"c"', empty)).toBe('abc')
    expect(evaluate('"x"&1', empty)).toBe('x1')
  })

  it('степень и процент', () => {
    expect(evaluate('2^10', empty)).toBe(1024)
    expect(evaluate('50%', empty)).toBe(0.5)
    expect(evaluate('-2^2', empty)).toBe(4)
  })
})

describe('логические функции', () => {
  it('IF / AND / OR / NOT / XOR', () => {
    expect(evaluate('IF(1>0, 10, 20)', empty)).toBe(10)
    expect(evaluate('IF(1>2, 10, 20)', empty)).toBe(20)
    expect(evaluate('AND(1>0, 2>1)', empty)).toBe(true)
    expect(evaluate('OR(1>2, 2>1)', empty)).toBe(true)
    expect(evaluate('NOT(1>2)', empty)).toBe(true)
    expect(evaluate('XOR(1>0, 1>2)', empty)).toBe(true)
  })

  it('IF с текстовыми ветками', () => {
    const c = ctx({'0:0': '7'})
    expect(evaluate('IF(A1>5, "много", "мало")', c)).toBe('много')
  })
})

describe('текстовые функции', () => {
  it('CONCAT / LEN / UPPER / LOWER / TRIM', () => {
    expect(evaluate('CONCAT("Hello", " ", "World")', empty)).toBe('Hello World')
    expect(evaluate('LEN("hello")', empty)).toBe(5)
    expect(evaluate('UPPER("abc")', empty)).toBe('ABC')
    expect(evaluate('LOWER("ABC")', empty)).toBe('abc')
    expect(evaluate('TRIM("  a   b ")', empty)).toBe('a b')
  })

  it('LEFT / RIGHT / MID', () => {
    expect(evaluate('LEFT("hello", 2)', empty)).toBe('he')
    expect(evaluate('RIGHT("hello", 2)', empty)).toBe('lo')
    expect(evaluate('MID("hello", 2, 3)', empty)).toBe('ell')
  })
})

describe('математические функции', () => {
  it('ABS / ROUND / POWER / SQRT / MOD / FACT', () => {
    expect(evaluate('ABS(-5)', empty)).toBe(5)
    expect(evaluate('ROUND(3.14159, 2)', empty)).toBe(3.14)
    expect(evaluate('POWER(2, 8)', empty)).toBe(256)
    expect(evaluate('SQRT(16)', empty)).toBe(4)
    expect(evaluate('MOD(10, 3)', empty)).toBe(1)
    expect(evaluate('FACT(5)', empty)).toBe(120)
  })

  it('тригонометрия и константы', () => {
    expect(evaluate('PI()', empty)).toBeCloseTo(Math.PI, 6)
    expect(evaluate('SIN(0)', empty)).toBe(0)
    expect(evaluate('COS(0)', empty)).toBe(1)
    expect(evaluate('LOG(100)', empty)).toBeCloseTo(2, 6)
    expect(evaluate('LN(EXP(1))', empty)).toBeCloseTo(1, 6)
  })
})

describe('статистические функции и корреляция', () => {
  const c = ctx({
    '0:0': '1', '1:0': '2', '2:0': '3', '3:0': '4', '4:0': '5', // A1:A5
    '0:1': '2', '1:1': '4', '2:1': '6', '3:1': '8', '4:1': '10' // B1:B5
  })

  it('MEDIAN / STDEV / VAR / VARP', () => {
    expect(evaluate('MEDIAN(A1:A5)', c)).toBe(3)
    expect(evaluate('VARP(A1:A5)', c)).toBe(2)
    expect(evaluate('VAR(A1:A5)', c)).toBe(2.5)
    expect(evaluate('STDEV(A1:A5)', c)).toBeCloseTo(1.5811, 3)
  })

  it('CORREL идеально линейных данных = 1', () => {
    expect(evaluate('CORREL(A1:A5, B1:B5)', c)).toBeCloseTo(1, 6)
  })

  it('COUNT / COUNTA / SUMPRODUCT', () => {
    expect(evaluate('COUNT(A1:A5)', c)).toBe(5)
    expect(evaluate('COUNTA(A1:A5)', c)).toBe(5)
    expect(evaluate('SUMPRODUCT(A1:A5, B1:B5)', c)).toBe(110)
  })
})

describe('evaluateCell с новыми типами', () => {
  it('текстовый результат', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=UPPER("hi")'}))).toBe('HI')
  })
  it('булев результат', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '=2>1'}))).toBe('TRUE')
  })
  it('нечисло в арифметике -> #VALUE!', () => {
    expect(evaluateCell('0:0', ctx({'0:0': '="abc"+1'}))).toBe('#VALUE!')
  })
})
