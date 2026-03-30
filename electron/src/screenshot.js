/**
 * SC2 Companion - 截图模块
 * 
 * 跨平台截图实现
 */

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG = {
  tempDir: os.tmpdir(),
  quality: 70, // JPEG 质量
  width: 1920,
  height: 1080
};

/**
 * 跨平台截图
 */
async function capture(options = {}) {
  const platform = process.platform;
  const { width, height, quality } = { ...CONFIG, ...options };

  try {
    switch (platform) {
      case 'win32':
        return await captureWindows(width, height, quality);
      case 'darwin':
        return await captureMac(width, height);
      case 'linux':
        return await captureLinux(width, height);
      default:
        throw new Error(`不支持的平台: ${platform}`);
    }
  } catch (e) {
    console.error('[Screenshot] 截图失败:', e.message);
    return null;
  }
}

/**
 * Windows 截图（使用 PowerShell）
 */
async function captureWindows(width, height, quality) {
  const tempFile = path.join(CONFIG.tempDir, `sc2_capture_${Date.now()}.png`);

  // 使用 PowerShell 的 System.Drawing
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
    
    # 缩放到指定大小
    $resized = New-Object System.Drawing.Bitmap(${width}, ${height})
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.DrawImage($bmp, 0, 0, ${width}, ${height})
    
    $resized.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bmp.Dispose()
    $resized.Dispose()
    $g.Dispose()
  `;

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script}"`, { timeout: 10000 }, (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        // 清理临时文件
        fs.unlinkSync(tempFile);

        resolve(base64);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * macOS 截图（使用 screencapture）
 */
async function captureMac(width, height) {
  const tempFile = path.join(CONFIG.tempDir, `sc2_capture_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    exec(`screencapture -x ${tempFile}`, { timeout: 5000 }, (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        // 使用 sips 缩放
        execSync(`sips -z ${height} ${width} ${tempFile}`);
        
        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        // 清理
        fs.unlinkSync(tempFile);

        resolve(base64);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Linux 截图（使用 scrot 或 gnome-screenshot）
 */
async function captureLinux(width, height) {
  const tempFile = path.join(CONFIG.tempDir, `sc2_capture_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // 尝试 scrot
    const cmd = `scrot ${tempFile} || gnome-screenshot -f ${tempFile}`;
    
    exec(cmd, { timeout: 5000 }, (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        if (!fs.existsSync(tempFile)) {
          throw new Error('截图文件不存在');
        }

        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        
        // 清理
        fs.unlinkSync(tempFile);

        resolve(base64);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 截图指定窗口（高级功能）
 */
async function captureWindow(windowName) {
  const platform = process.platform;

  try {
    switch (platform) {
      case 'win32':
        return await captureWindowWindows(windowName);
      case 'darwin':
        return await captureWindowMac(windowName);
      default:
        // 不支持，返回全屏截图
        return await capture();
    }
  } catch (e) {
    console.error('[Screenshot] 窗口截图失败:', e.message);
    return await capture();
  }
}

/**
 * Windows 窗口截图
 */
async function captureWindowWindows(windowName) {
  const tempFile = path.join(CONFIG.tempDir, `sc2_window_${Date.now()}.png`);

  // 使用 PowerShell 查找窗口并截图
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $hwnd = (Get-Process | Where-Object { $_.MainWindowTitle -like '*${windowName}*' } | Select-Object -First 1).MainWindowHandle
    
    if ($hwnd) {
      $cap = [System.Drawing.Graphics]::FromHwnd($hwnd)
      $rect = [System.Windows.Forms.Rectangle]::FromLTRB(0, 0, [int]($cap.VisibleClipBounds.Width), [int]($cap.VisibleClipBounds.Height))
      $bmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($rect.Location, [System.Drawing.Point]::Empty, $rect.Size)
      $bmp.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose()
      $bmp.Dispose()
      $cap.Dispose()
      Write-Output 'OK'
    } else {
      Write-Output 'NOT_FOUND'
    }
  `;

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script}"`, { timeout: 10000 }, (err, stdout) => {
      if (err || stdout.trim() === 'NOT_FOUND') {
        resolve(null); // 窗口未找到
        return;
      }

      try {
        const imageBuffer = fs.readFileSync(tempFile);
        const base64 = imageBuffer.toString('base64');
        fs.unlinkSync(tempFile);
        resolve(base64);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * macOS 窗口截图
 */
async function captureWindowMac(windowName) {
  const tempFile = path.join(CONFIG.tempDir, `sc2_window_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // 使用 screencapture -W 交互式选择窗口
    exec(`screencapture -iW ${tempFile}`, { timeout: 10000 }, (err) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        if (fs.existsSync(tempFile)) {
          const imageBuffer = fs.readFileSync(tempFile);
          const base64 = imageBuffer.toString('base64');
          fs.unlinkSync(tempFile);
          resolve(base64);
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
  capture,
  captureWindow
};
