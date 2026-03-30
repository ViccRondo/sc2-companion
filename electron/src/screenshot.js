/**
 * SC2 Companion - 智能截图模块
 * 
 * 自动截取前台窗口，不需要手动配置窗口标题
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG = {
  tempDir: os.tmpdir(),
  width: 1280,   // 缩小分辨率节省 token
  height: 720
};

/**
 * 截取前台窗口（智能自动）
 */
async function captureForeground() {
  const platform = process.platform;

  try {
    switch (platform) {
      case 'win32':
        return await captureForegroundWindows();
      case 'darwin':
        return await captureForegroundMac();
      case 'linux':
        return await captureForegroundLinux();
      default:
        throw new Error(`不支持的平台: ${platform}`);
    }
  } catch (e) {
    console.error('[Screenshot] 前台窗口截图失败:', e.message);
    return null;
  }
}

/**
 * Windows：截取前台窗口
 */
async function captureForegroundWindows() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_fg_${Date.now()}.png`);

  // PowerShell：获取前台窗口并截图
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    # 获取前台窗口
    $hwnd = [System.Windows.Forms.UserActivityMonitor.Win32Api]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) { Write-Output "NO_WINDOW"; exit }
    
    # 获取窗口标题
    $title = [System.Runtime.InteropServices.Marshal]::GetWindowText($hwnd)
    if ([string]::IsNullOrEmpty($title)) { $title = "Untitled" }
    
    # 获取窗口位置和大小
    $rect = New-Object System.Windows.Forms.Rectangle
    [System.Windows.Forms.Native]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
    
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    
    if ($width -le 0 -or $height -le 0) { Write-Output "INVALID_WINDOW"; exit }
    
    # 创建截图
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, New-Object System.Drawing.Size($width, $height))
    
    # 缩放
    $resized = New-Object System.Drawing.Bitmap(${CONFIG.width}, ${CONFIG.height})
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmp, 0, 0, ${CONFIG.width}, ${CONFIG.height})
    
    $resized.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
    
    # 清理
    $graphics.Dispose()
    $bmp.Dispose()
    $g.Dispose()
    $resized.Dispose()
    
    # 输出窗口信息
    Write-Output "OK|$title|$width|$height"
  `;

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script}"`, { timeout: 10000 }, (err, stdout) => {
      const output = stdout.trim();
      
      if (err || output.startsWith('NO_WINDOW') || output.startsWith('INVALID_WINDOW')) {
        resolve(null);
        return;
      }

      try {
        const parts = output.split('|');
        const status = parts[0];
        const windowTitle = parts[1] || 'Unknown';
        
        if (status !== 'OK') {
          resolve(null);
          return;
        }

        console.log(`[Screenshot] 截图: ${windowTitle} (${parts[2]}x${parts[3]})`);

        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        fs.unlinkSync(tempFile);

        resolve({
          data: base64,
          windowTitle,
          width: CONFIG.width,
          height: CONFIG.height
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * macOS：截取前台窗口
 */
async function captureForegroundMac() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_fg_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // 使用 screencapture -Wo 截取前台窗口（带窗口阴影）
    exec(`screencapture -Wxo ${tempFile}`, { timeout: 5000 }, (err) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        if (!fs.existsSync(tempFile)) {
          resolve(null);
          return;
        }

        // 缩放
        execSync(`sips -z ${CONFIG.height} ${CONFIG.width} ${tempFile} --out ${tempFile}`);

        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        fs.unlinkSync(tempFile);

        resolve({
          data: base64,
          windowTitle: 'Active Window',
          width: CONFIG.width,
          height: CONFIG.height
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Linux：截取前台窗口
 */
async function captureForegroundLinux() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_fg_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // 使用 scrot 配合选择或 maim
    const cmd = `maim -i $(xdotool getactivewindow) ${tempFile} 2>/dev/null || scrot -u ${tempFile} 2>/dev/null || scrot ${tempFile}`;
    
    exec(cmd, { timeout: 5000 }, (err) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        if (!fs.existsSync(tempFile)) {
          resolve(null);
          return;
        }

        // 缩放（使用 ImageMagick）
        try {
          execSync(`convert ${tempFile} -resize ${CONFIG.width}x${CONFIG.height} ${tempFile}`);
        } catch (e) {}

        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        fs.unlinkSync(tempFile);

        resolve({
          data: base64,
          windowTitle: 'Active Window',
          width: CONFIG.width,
          height: CONFIG.height
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 备用：截取全屏
 */
async function captureScreen() {
  const platform = process.platform;

  try {
    switch (platform) {
      case 'win32':
        return await captureScreenWindows();
      case 'darwin':
        return await captureScreenMac();
      case 'linux':
        return await captureScreenLinux();
      default:
        return null;
    }
  } catch (e) {
    console.error('[Screenshot] 全屏截图失败:', e.message);
    return null;
  }
}

async function captureScreenWindows() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_screen_${Date.now()}.png`);

  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen([System.Drawing.Point]::Empty, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
    
    $resized = New-Object System.Drawing.Bitmap(${CONFIG.width}, ${CONFIG.height})
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.DrawImage($bmp, 0, 0, ${CONFIG.width}, ${CONFIG.height})
    
    $resized.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bmp.Dispose()
    $g.Dispose()
    $resized.Dispose()
    
    Write-Output 'OK'
  `;

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script}"`, { timeout: 10000 }, (err, stdout) => {
      if (err || !stdout.trim().startsWith('OK')) {
        resolve(null);
        return;
      }

      try {
        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        fs.unlinkSync(tempFile);

        resolve({
          data: base64,
          windowTitle: 'Desktop',
          width: CONFIG.width,
          height: CONFIG.height
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function captureScreenMac() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_screen_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    exec(`screencapture -x ${tempFile}`, { timeout: 5000 }, (err) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        execSync(`sips -z ${CONFIG.height} ${CONFIG.width} ${tempFile} --out ${tempFile}`);
        
        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        fs.unlinkSync(tempFile);

        resolve({
          data: base64,
          windowTitle: 'Desktop',
          width: CONFIG.width,
          height: CONFIG.height
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function captureScreenLinux() {
  const tempFile = path.join(CONFIG.tempDir, `sc2_screen_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    exec(`scrot ${tempFile} || gnome-screenshot`, { timeout: 5000 }, (err) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        if (fs.existsSync(tempFile)) {
          const imageBuffer = fs.readFileSync(tempFile);
          const base64 = imageBuffer.toString('base64');
          fs.unlinkSync(tempFile);

          resolve({
            data: base64,
            windowTitle: 'Desktop',
            width: CONFIG.width,
            height: CONFIG.height
          });
        } else {
          resolve(null);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = {
  captureForeground,
  captureScreen
};
