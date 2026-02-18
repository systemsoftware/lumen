const { exec } = require('child_process');

function getActiveContextMac() {
  return new Promise((resolve) => {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        try
          set windowTitle to name of front window of frontApp
        on error
          set windowTitle to ""
        end try
        return appName & "|||" & windowTitle
      end tell
    `;

    exec(`osascript -e '${script}'`, (err, stdout) => {
      const [appName, windowTitle] = stdout.trim().split('|||');
      resolve({ appName, windowTitle });
    });
  });
}

function getActiveContextWindows() {
  return new Promise((resolve) => {
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $title = New-Object System.Text.StringBuilder 1024
      [Win32]::GetWindowText($hwnd, $title, $title.Capacity) | Out-Null
      $proc = Get-Process | Where-Object { $_.MainWindowTitle -eq $title.ToString() }
      "$($proc.ProcessName)|||$title"
    `;

    exec(`powershell -command "${ps}"`, (err, stdout) => {
      const [appName, windowTitle] = stdout.trim().split('|||');
      resolve({ appName, windowTitle });
    });
  });
}

function getActiveContextLinux() {
  return new Promise((resolve) => {
    exec(
      `xprop -root _NET_ACTIVE_WINDOW | awk '{print $5}' | xargs -I {} xprop -id {} _NET_WM_NAME WM_CLASS`,
      (err, stdout) => {
        resolve({
          appName: extractClass(stdout),
          windowTitle: extractTitle(stdout)
        });
      }
    );
  });
}

module.exports = () => new Promise(async (resolve) => {
  let context;
  if (process.platform === 'darwin') {
    context = await getActiveContextMac();
  } else if (process.platform === 'win32') {
    context = await getActiveContextWindows();
  } else {
    context = await getActiveContextLinux();
  }
  resolve(context);
});