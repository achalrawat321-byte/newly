const path = require('path');
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');

// 🔐 FORCE dotenv to load correctly
require('dotenv').config({
  path: path.join(__dirname, '.env')
});

console.log('API KEY FOUND:', !!process.env.GOOGLE_API_KEY);

const ai = new GoogleGenAI({});

// ================================
// FILE TOOLS
// ================================

async function listFiles({ directory }) {
  const files = [];
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css'];

  function scan(dir) {
    let items;
    try {
      items = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item);

      if (
        fullPath.includes('node_modules') ||
        fullPath.includes('dist') ||
        fullPath.includes('build')
      ) {
        continue;
      }

      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }

  scan(directory);
  return { files };
}

async function readFile({ file_path }) {
  try {
    const content = fs.readFileSync(file_path, 'utf-8');
    return { content };
  } catch (error) {
    return {
      error: true,
      message: error.message
    };
  }
}

async function writeFile({ file_path, content }) {
  try {
    fs.writeFileSync(file_path, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return {
      error: true,
      message: error.message
    };
  }
}


// ================================
// TOOL REGISTRY
// ================================

const tools = {
  list_files: listFiles,
  read_file: readFile,
  write_file: writeFile
};

// ================================
// TOOL DEFINITIONS
// ================================

const toolDeclarations = [
  {
    name: 'list_files',
    description: 'List all project source files',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: { type: Type.STRING }
      },
      required: ['directory']
    }
  },
  {
    name: 'read_file',
    description: 'Read file content',
    parameters: {
      type: Type.OBJECT,
      properties: {
        file_path: { type: Type.STRING }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_file',
    description: 'Write updated file content',
    parameters: {
      type: Type.OBJECT,
      properties: {
        file_path: { type: Type.STRING },
        content: { type: Type.STRING }
      },
      required: ['file_path', 'content']
    }
  }
];

// ================================
// MAIN AGENT
// ================================

async function runAgent(directoryPath) {
  console.log('🔍 Reviewing project: ${directoryPath}');

  const history = [
    {
      role: 'user',
      parts: [{ text:' Review and fix code in: ${directoryPath}' }]
    }
  ];

  let steps = 0;
  const MAX_STEPS = 15;

  while (steps++ < MAX_STEPS) {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: history,
      config: {
        systemInstruction: `
You are an expert code reviewer.
Use tools to:
1. List files
2. Read files
3. Fix real issues
4. Write corrected code
When finished, return ONLY a text summary.
        `,
        tools: [
          {
            functionDeclarations: toolDeclarations
          }
        ]
      }
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.filter(p => p.functionCall);

    if (functionCalls.length > 0) {
      for (const part of functionCalls) {
        const call = part.functionCall;
        const response = await tools[call.name](call.args);

        history.push({
          role: 'model',
          parts: [{ functionCall: call }]
        });

        history.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: { result: response }
              }
            }
          ]
        });
      }
    } else {
      console.log('\n📊 CODE REVIEW SUMMARY\n');
      console.log(result.text);
      break;
    }
  }
}

module.exports = { runAgent };