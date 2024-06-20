import {
  formatOffenses,
  formatOffensesJson,
  formatSummary,
  handleExit,
  initConfig,
  renderOffensesText,
  sortOffenses,
} from './check.js'
import {fileExists, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {Severity, SourceCodeType, loadConfig, type Offense, type Theme} from '@shopify/theme-check-node'
import {Mock, MockInstance, afterAll, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs', async () => ({
  fileExists: vi.fn(),
  writeFile: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/output', async () => ({
  outputInfo: vi.fn(),
  outputSuccess: vi.fn(),
}))

vi.mock('@shopify/theme-check-node', async () => {
  const actual: any = await vi.importActual('@shopify/theme-check-node')
  return {
    ...actual,
    loadConfig: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/ui', async () => ({
  renderInfo: vi.fn(),
}))

describe('formatOffenses', () => {
  beforeEach(() => {
    const readFileMock = readFileSync as Mock
    readFileMock.mockReturnValue({toString: () => 'Line1\nLine2\nLine3'})
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  test('should format offenses correctly', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]

    const result = formatOffenses(offenses)

    /**
     * Line numbers are 0-indexed to remain backwards compatible with the ruby theme-check output
     * Thats why given line:1 in the offense, we expect the second mocked line in the final output
     */
    expect(result).toEqual([
      {error: '\n[error]:'},
      {bold: 'LiquidHTMLSyntaxError'},
      {subdued: '\nAttempting to close HtmlElement'},
      '\n\n2  Line2',
      '',
    ])
  })

  test('should format multiple offenses correctly', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]

    const result = formatOffenses(offenses)

    expect(result).toEqual([
      {error: '\n[error]:'},
      {bold: 'LiquidHTMLSyntaxError'},
      {subdued: '\nAttempting to close HtmlElement'},
      '\n\n2  Line2',
      '\n\n',
      {warn: '\n[warning]:'},
      {bold: 'LiquidHTMLSyntaxError'},
      {subdued: '\nAttempting to close HtmlElement'},
      '\n\n3  Line3',
      '',
    ])
  })
})

describe('sortOffenses', () => {
  test('should sort offenses by file path', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file2',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file1',
        severity: Severity.WARNING,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]

    const result = sortOffenses(offenses)

    expect(result).toEqual({
      '/path/to/file1': [offenses[1]],
      '/path/to/file2': [offenses[0]],
    })
  })

  test('should sort offenses by severity within each file', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]

    const result = sortOffenses(offenses)

    expect(result).toEqual({
      '/path/to/file': [offenses[1], offenses[0]],
    })
  })
})

describe('formatSummary', () => {
  test('should format summary correctly when no offenses found', () => {
    const offenses: Offense[] = []
    const theme: unknown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const result = formatSummary(offenses, {}, theme as Theme)

    expect(result).toEqual(['10 files inspected', 'with no offenses found.'])
  })

  test('should format summary correctly when offenses found', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]
    const theme: unknown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const result = formatSummary(offenses, {}, theme as Theme)

    expect(result).toEqual([
      '10 files inspected',
      'with 2 total offenses found across 0 files.',
      '\n1 errors.',
      '\n1 warnings.',
    ])
  })
})

describe('renderOffensesText', () => {
  beforeEach(() => {
    const readFileMock = readFileSync as Mock
    readFileMock.mockReturnValue('Line1\nLine2\nLine3')
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  test('should call renderInfo for offenses', () => {
    const offensesByFile = {
      '/path/to/file': [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.ERROR,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
      ],
    }
    const themeRootPath = '/path/to'

    renderOffensesText(offensesByFile, themeRootPath)

    expect(renderInfo).toHaveBeenCalledTimes(1)
  })
})

describe('formatOffensesJson', () => {
  test('should format offenses into JSON correctly', () => {
    const offensesByFile = {
      '/path/to/file': [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.ERROR,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.WARNING,
          start: {index: 0, line: 2, character: 0},
          end: {index: 10, line: 2, character: 10},
        },
      ],
    }

    const result = formatOffensesJson(offensesByFile)

    expect(result).toEqual([
      {
        path: '/path/to/file',
        offenses: [
          {
            check: 'LiquidHTMLSyntaxError',
            severity: 'error',
            start_row: 1,
            start_column: 0,
            end_row: 1,
            end_column: 10,
            message: 'Attempting to close HtmlElement',
          },
          {
            check: 'LiquidHTMLSyntaxError',
            severity: 'warning',
            start_row: 2,
            start_column: 0,
            end_row: 2,
            end_column: 10,
            message: 'Attempting to close HtmlElement',
          },
        ],
        errorCount: 1,
        warningCount: 1,
        infoCount: 0,
      },
    ])
  })
})

describe('handleExit', () => {
  let exitSpy: MockInstance<[code?: number | undefined], never>

  beforeEach(() => {
    // Create a spy on process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(vi.fn())
  })

  afterAll(() => {
    // Restore the original process.exit function after each test
    exitSpy.mockRestore()
  })

  test('should exit with 0 when crash fail level is set', () => {
    const offenses: Offense[] = []
    handleExit(offenses, 'crash')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('should exit with 1 when offenses severity is less than fail level', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]
    handleExit(offenses, 'suggestion')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('should exit with 1 when offenses severity is equal to the fail level', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]
    handleExit(offenses, 'error')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('should exit with 0 when offenses severity is not less than fail level', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.INFO,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]
    handleExit(offenses, 'warning')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

describe('initConfig', () => {
  let fileMock: Mock
  let loadConfigMock: Mock

  beforeEach(() => {
    fileMock = fileExists as Mock
    loadConfigMock = loadConfig as Mock
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  test('should not create a new config file if one already exists', async () => {
    fileMock.mockResolvedValue(true)

    await initConfig('/path/to/root')

    expect(fileExists).toHaveBeenCalledWith('/path/to/root/.theme-check.yml')
    expect(outputInfo).toHaveBeenCalledWith('.theme-check.yml already exists at /path/to/root')
    expect(writeFile).toHaveBeenCalledTimes(0)
  })

  test('should create a new config file if one does not exist', async () => {
    fileMock.mockResolvedValue(false)
    loadConfigMock.mockResolvedValue({settings: {}})

    await initConfig('/path/to/root')

    expect(fileExists).toHaveBeenCalledWith('/path/to/root/.theme-check.yml')
    expect(loadConfig).toHaveBeenCalledWith(undefined, '/path/to/root')
    expect(writeFile).toHaveBeenCalledWith('/path/to/root/.theme-check.yml', expect.any(String))
    expect(outputSuccess).toHaveBeenCalledWith('Created .theme-check.yml at /path/to/root')
  })
})
