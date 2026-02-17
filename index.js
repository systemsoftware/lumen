const { app, BrowserWindow, desktopCapturer, screen, ipcMain, dialog, globalShortcut, Menu } = require('electron');
const { writeFile, readFile } = require('fs').promises;
const tesseract = require('tesseract.js');
const ollama = require('ollama').default;
const { spawn, exec } = require('child_process');
const menubar = require('menubar.js');
const dubnium = require('dubnium');
const path = require('path')
const saveCapture = require('./embed');
const { randomUUID } = require('crypto');
const { semanticSearch } = require('./search');

function stripAnsi(str) {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ''
  );
}


const db = new dubnium(path.join(app.getPath('userData'), 'db'));

module.exports.db = db;

let ollamaPid = null;

const env = { ...process.env };

let ready = false

const userdata = app.getPath('userData');
console.log('User data path:', userdata);

env.PATH = `${env.PATH}${process.platform === 'win32' ? ';' : ':'}${app.getPath('home')}/.ollama/bin`;

const cmdExists = (cmd) => {
  return new Promise((resolve) => {
    spawn('ollama', ['--version'], { env, shell: true }).on('close', (code) => {
      console.log(`Command "${cmd}" existence check exited with code:`, code);
      resolve(code === 0);
    });
  });

}

const shortcuts = {
  "Summarize":"Summarize the following text:\n\n",
  "Explain":"Explain the following text:\n\n",
  "Translate":"Translate the following text to English:\n\n",
  "Code Review":"Review the following code and provide feedback:\n\n",
  "Debug":"Identify potential issues in the following code:\n\n",
  "Optimize":"Suggest optimizations for the following code:\n\n",
  "Document":"Generate documentation for the following code:\n\n",
  "Refactor":"Refactor the following code for better readability and performance:\n\n"
}


const pullText = async (image, settings = {}, path) => {
  if (settings.visionModel && settings.visionModel !== 'Tesseract') {
    const ollamaList = await ollama.list();
    const modelNames = ollamaList.models.map(m => m.name);
    if (!modelNames.includes(settings.visionModel)) {
      console.warn(`Specified vision model "${settings.visionModel}" not found in Ollama models. Available models:`, modelNames);
      dialog.showErrorBox('Vision Model Not Found', `The specified vision model "${settings.visionModel}" was not found in Ollama. Please check your settings and ensure the model is available.`);
      return '';
    }
    try {
      const response = await ollama.generate({
        model: settings.visionModel,
        prompt: 'Extract all readable text from this image. Language is ' + (settings.lang || 'unknown'),
        images: [image],
      });

      const text = response?.response?.trim();
      if (text) return text;
    } catch (err) {
      console.warn('Ollama OCR failed, falling back to Tesseract:', err.message);
    }
  } else {
    console.log('No vision model specified, skipping Ollama OCR and using Tesseract directly.');
  }

  try {
    const result = await tesseract.recognize(
      path,
      settings.lang || 'eng',
    );

    return result.data.text.trim();
  } catch (err) {
    console.error('Tesseract OCR failed:', err);
    throw new Error('OCR failed using both Ollama and Tesseract');
  }
};

spawn('ollama', ['version'], { env, shell: true }).on('error', (err) => {
 dialog.showErrorBox('Ollama Not Found', 'The "ollama" command was not found. Please ensure Ollama is installed and the command is available in your PATH.');
app.quit();
});

exec('ollama list', { env, shell: true }, (error, stdout) => {
  if (!stdout.includes('nomic-embed-text')) {
    console.log('Pulling nomic-embed-text');
    spawn('ollama', ['pull', 'nomic-embed-text'], { env, shell: true });
  } else{
    console.log('Has nomic-embed-text model already.');
  }
});

app.on('ready', async () => {
console.log('Ollama AI integration enabled in settings; checking for ollama command...');
cmdExists('ollama').then(exists => {
if(exists) {
console.log('Ollama command found; starting Ollama server...');
const op = spawn('ollama', ['serve'], { env });
console.log('Ollama server started with PID:', op.pid);
ollamaPid = op.pid;
}else{
  console.log('Ollama command not found; skipping Ollama server start.');
}
})


const overlayWindow = new BrowserWindow({
  width: screen.getPrimaryDisplay().size.width,
  height: screen.getPrimaryDisplay().size.height,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  resizable: false,
  movable: false,
  skipTaskbar: true,
  backgroundColor:'rgba(0, 0, 0, 0.08)',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true
  },
  show: false
})

let curr = ''

overlayWindow.loadFile('overlay.html');
ipcMain.handle('capture', async (event, rect) => {
  ready = false;
  console.log('Received capture request with rect:', rect);
  overlayWindow.hide();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screen.getPrimaryDisplay().size
  });
  const image = sources[0].thumbnail;
  const cropped = image.crop({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  });
  overlayWindow.reload();
  const aiWindow = new BrowserWindow({
    width: screen.getPrimaryDisplay().size.width,
    height: screen.getPrimaryDisplay().size.height,
    transparent: true,
    frame: false,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    backgroundColor:'rgba(0, 0, 0, .5)',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  aiWindow.webContents.on('did-finish-load', () => {
    aiWindow.webContents.send('capture-result', cropped.toDataURL());
  });

  aiWindow.loadFile('ai.html');

  aiWindow.webContents.on('did-finish-load', async () => {
    if(ready) aiWindow.webContents.send('ready');
  })

  await writeFile(path.join(userdata, 'screenshot.png'), cropped.toPNG());

  curr = randomUUID();

  const data = await pullText(cropped.toDataURL().replace(/^data:image\/\w+;base64,/, ''), settings, path.join(userdata, 'screenshot.png'));

  await writeFile(path.join(userdata, 'screenshot.txt'), data, 'utf-8');

  aiWindow.webContents.send('ready', data);
  ready = true;

  console.log('Extracted text from screenshot:', data);

  db.create(curr, {
    ocr: data,
    timestamp: Date.now(),
  })

  if(parseInt(settings.historyLimit)) {
    const all = await db.getAll({ tagOnly:false });
    const sorted = all.sort((a, b) => b.read().timestamp - a.read().timestamp);
    const toDelete = sorted.slice(parseInt(settings.historyLimit));
    for(const item of toDelete) {
      await db.delete(item.tag);
    }
  }

});


ipcMain.handle('get-shortcuts', async () => {
  return shortcuts;
})

const settings = JSON.parse(await readFile(path.join(userdata, 'settings.json'), 'utf-8').catch(() => '{}'));

console.log('Loaded settings:', settings);

ipcMain.handle('query-ollama', async (e, prompt) => {
  const win = e.sender
  try{
console.log('Querying Ollama...');
if(settings.aiThink === 'false') settings.aiThink = false;
if(settings.aiThink === 'true') settings.aiThink = true;
const meta = await ollama.show({ model: settings.aiModel })

console.log('Ollama model metadata:', meta);

user = shortcuts[prompt] ? shortcuts[prompt] : prompt;

let config = {
system: 'The following screenshot was taken from a user\'s desktop. Use the information in the screenshot to answer the user\'s query. If the screenshot contains text, prioritize that text in your response. If the screenshot contains an error message, use that information to help diagnose the issue. Always provide a helpful and informative response based on the content of the screenshot and the user\'s query. Text extracted from the screenshot:\n\n' + (await readFile(path.join(userdata, 'screenshot.txt'), 'utf-8')),
model: settings.aiModel,
prompt: user,
stream: true,
}

if(meta.capabilities.includes('thinking')){
 config.think = settings.aiThink;
if(typeof config.think !== 'boolean' || typeof config.think != 'string') config.think = false;
}

let completeResponse = '';

chat = await ollama.generate(config);
for await (const chunk of chat) {
  let type = 'message';
  let message = chunk?.response;

  if (message.length === 0) {
    message = chunk?.thinking || '';
    type = 'thinking';
  }

    if (message.length === 0) {
    continue;
  }

    win.send('ai-response', {
      message,
      type
    });
  completeResponse += message;
}
win.send('ai-response', {
  message: '',
  type: 'done',
});

await saveCapture({
  ocrText: await readFile(path.join(userdata, 'screenshot.txt'), 'utf-8'),
  response: completeResponse,
  id: curr
});

console.log('Ollama query complete.');
  }catch(e){
    console.error('Ollama query failed:', e);
    dialog.showErrorBox('Ollama Error', `Failed to query Ollama: ${e.message}`);
    win.send('ai-response', {
      message: '',
      type: 'done',
    });
  }
});

app.on('will-quit', () => {
  try{
  if (ollamaPid) {
    console.log('Killing Ollama server with PID:', ollamaPid);
    process.kill(ollamaPid);
  }
}catch{

}
})


globalShortcut.register(settings.shortcut || 'CmdOrCtrl+Shift+A', () => {
if(!settings.aiModel) return dialog.showErrorBox('No AI Model Set', 'Please set an AI model in the settings before using the shortcut.');
overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
});

const tray = await menubar({
    width: screen.getPrimaryDisplay().size.width,
    height: screen.getPrimaryDisplay().size.height,
    transparent: true,
    frame: false,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    backgroundColor:'rgba(0, 0, 0, .5)',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
}, './icon.png', 'detach')
tray.window.loadFile('search.html');

tray.tray.on('click', () => {
if(!settings.aiModel) tray.window.hide()
})

let hasSettingsOpen = false;
let hasHistoryOpen = false;

tray.tray.on('right-click', () => {
const menu = Menu.buildFromTemplate([
  {
    label: 'Settings',
    click: () => {
      if (hasSettingsOpen) return;
      const settingsWindow = new BrowserWindow({
        width: 600,
        height: 800,
        resizable: false,
        webPreferences: {
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        },
      });
      settingsWindow.loadFile('settings.html');
      hasSettingsOpen = true;
      settingsWindow.on('closed', () => {
        hasSettingsOpen = false;
      });
    }
  },
  {
    label: 'History',
    click: () => {
      if (hasHistoryOpen) return;
      const historyWindow = new BrowserWindow({
        width: screen.getPrimaryDisplay().size.width * 0.8,
        height: screen.getPrimaryDisplay().size.height * 0.8,
        transparent:true,
        frame: false,
        resizable: true,
        movable: true,
        skipTaskbar: false,
        titleBarStyle: 'hidden',
        backgroundColor:'rgba(0, 0, 0, .5)',
        webPreferences: {
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        },
      });
      historyWindow.loadFile('history.html');
      hasHistoryOpen = true;
      historyWindow.on('closed', () => {
        hasHistoryOpen = false;
      });
    }
  },
  {
    label: 'Quit',
    click: () => {
      app.quit();
    }
  }
]);
menu.popup();
})

tray.window.webContents.on('did-finish-load', async () => {
  if(!settings.aiModel) {
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Open Settings', 'Cancel'],
      title: 'No AI Model Set',
      message: 'You must have an AI model downloaded and set in the settings before using the app.'
    }).then(result => {
if(result.response === 0) {
    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 800,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
    });
    settingsWindow.loadFile('settings.html');
    settingsWindow.webContents.openDevTools();
  }else {
   app.quit();
  }
    })
  }
  })

tray.window.on('close', (e) => {
app.quit();
})

ipcMain.handle('fetch-setting', async (e, setting) => {
  return settings[setting];
})

ipcMain.handle('fetch-models', async () => {
  try {
    const models = (await ollama.list()).models;
    return models.map(m => m.name);
  } catch (e) {
    console.error('Failed to fetch models from Ollama:', e);
    return [];
  }
})

  ipcMain.handle('search', async (event, query) => {
    const matches = await semanticSearch(query, 5)

    const context = matches.map((m, i) =>
      `${i + 1}. ${m.text}\nAI note: ${m.response}`
    ).join('\n\n')

    const prompt = `
  You are answering questions using the user's past screenshots.

  Relevant captures:
  ${context}

  User question:
  "${query}"

  Answer using only the information above.
  `

    const response = await ollama.generate({
      model: JSON.parse(await readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf-8')).aiModel,
      prompt: prompt,
      stream: true
    })

    let completeResponse = '';
    for await (const chunk of response) {
      const message = chunk?.response || '';
      if (message.length > 0) {
        completeResponse += message;
        tray.window.webContents.send('search-response', message);
      }
    }

    tray.window.webContents.send('search-response-done', {
      response: completeResponse,
      matches
    });
  });

ipcMain.handle('set-setting', async (e, key, value) => {
  settings[key] = value;
  await writeFile(path.join(userdata, 'settings.json'), JSON.stringify(settings), 'utf-8');
});

ipcMain.handle('get-history', async () => {
  const all = await db.getAll({ tagOnly:false });
  const history = await Promise.all(all.map(async item => {
    const data = await item.read();
    return { id: item.tag, ...data }
  }))
  return history.sort((a, b) => b.timestamp - a.timestamp);
})


ipcMain.handle('pull-model', async (e, model) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  const op = spawn('ollama', ['pull', model], { env });

  const send = (chunk) => {
    const clean = stripAnsi(chunk.toString());
    win.webContents.send('model-pull-log', clean);
  };

  op.stdout.on('data', send);
  op.stderr.on('data', send);
});

ipcMain.handle('delete-model', async (e, model) => {
  
  const p = spawn('ollama', ['rm', model], { env, shell: true });

  p.on('close', (code) => {
    if (code === 0) {
      dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Model Deleted',
        message: `The model "${model}" was successfully deleted.`
      });
      e.sender.reload();
    } else {
      dialog.showErrorBox('Deletion Failed', `Failed to delete model "${model}". Please check the model name and try again.`);
    }
  });

});


ipcMain.handle('delete-history-entry', async (e, id) => {
  await db.delete(id);
})


})