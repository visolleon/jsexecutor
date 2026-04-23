const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const app = express();
const port = 3001;

// 配置
const API_TOKEN = process.env.API_TOKEN || 'your-default-token'; // API访问Token
const FILE_URL_PREFIX = process.env.FILE_URL_PREFIX || ''; // 文件URL前缀
const SERVER_HOST = process.env.SERVER_HOST || 'localhost'; // 服务器主机名
const SERVER_PORT = process.env.SERVER_PORT || port; // 服务器端口
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '256kb'; // 请求体大小限制

// 创建tasks目录用于存储任务文件
const tasksDir = path.join(__dirname, 'tasks');
if (!fs.existsSync(tasksDir)) {
  fs.mkdirSync(tasksDir, { recursive: true });
}

// 设置静态文件目录，用于提供生成的文件
app.use('/tasks', express.static(tasksDir));
// 增加请求体大小限制，防止PayloadTooLargeError
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// 生成日期路径
function getDatePath() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// 生成完整的文件URL
function getFileUrl(datePath, taskId, filename) {
  const urlPath = `/tasks/${datePath}/${taskId}/${filename}`;
  if (FILE_URL_PREFIX) {
    return FILE_URL_PREFIX + urlPath;
  } else {
    // 默认使用服务器的完整域名
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${SERVER_HOST}:${SERVER_PORT}${urlPath}`;
  }
}

// Token验证中间件
function validateToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  next();
}

// 安全配置
const MAX_EXECUTION_TIME = 60000; // 最大执行时间：60秒
const MAX_MEMORY = '512m'; // 最大内存：512MB
const DANGEROUS_PACKAGES = ['child_process', 'fs', 'net', 'http', 'https', 'os', 'path', 'process', 'require'];

// 清理目录函数
function cleanupDirectory(dir) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        if (file === 'node_modules') {
          // 递归删除node_modules
          try {
            execSync(`rm -rf ${filePath}`, { stdio: 'ignore' });
          } catch (error) {
            console.error(`Error cleaning up node_modules: ${error.message}`);
          }
        } else {
          cleanupDirectory(filePath);
        }
      }
    }
  }
}

// 执行代码的API端点
app.post('/execute', validateToken, (req, res) => {
  let taskId = null;
  let taskDir = null;
  
  try {
    const { code, libraries } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // 记录任务开始时间
    const startTime = Date.now();
    
    // 生成任务UUID
    taskId = uuidv4();
    console.log(`[Task ${taskId}] Starting execution`);
    
    // 生成日期路径
    const datePath = getDatePath();
    taskDir = path.join(tasksDir, datePath, taskId);
    console.log(`[Task ${taskId}] Created task directory: ${taskDir}`);
    
    // 创建任务目录
    fs.mkdirSync(taskDir, { recursive: true });
    
    // 验证和过滤依赖
    const safeLibraries = [];
    if (libraries && Array.isArray(libraries)) {
      console.log(`[Task ${taskId}] Validating ${libraries.length} dependencies`);
      for (const lib of libraries) {
        if (typeof lib === 'string' && !DANGEROUS_PACKAGES.includes(lib)) {
          safeLibraries.push(lib);
        } else {
          console.warn(`[Task ${taskId}] Skipping dangerous package: ${lib}`);
        }
      }
      console.log(`[Task ${taskId}] ${safeLibraries.length} safe dependencies found`);
    }
    
    // 创建package.json文件
    const packageJson = {
      name: `task-${taskId}`,
      version: '1.0.0',
      dependencies: {}
    };
    
    // 添加要安装的依赖
    safeLibraries.forEach(lib => {
      packageJson.dependencies[lib] = 'latest';
    });
    
    fs.writeFileSync(path.join(taskDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    console.log(`[Task ${taskId}] Created package.json with ${safeLibraries.length} dependencies`);
    
    // 安装依赖
    console.log(`[Task ${taskId}] Installing dependencies...`);
    const installStart = Date.now();
    execSync('npm install', { 
      cwd: taskDir, 
      stdio: 'inherit',
      timeout: MAX_EXECUTION_TIME
    });
    console.log(`[Task ${taskId}] Dependencies installed in ${Date.now() - installStart}ms`);
    
    // 创建执行文件
    const execFile = path.join(taskDir, 'index.js');
    fs.writeFileSync(execFile, code);
    console.log(`[Task ${taskId}] Created execution file: ${execFile}`);
    
    // 执行代码
    console.log(`[Task ${taskId}] Executing code...`);
    const execStart = Date.now();
    execSync(`node --max-old-space-size=${MAX_MEMORY.replace('m', '')} index.js`, { 
      cwd: taskDir, 
      stdio: 'inherit',
      timeout: MAX_EXECUTION_TIME
    });
    console.log(`[Task ${taskId}] Code executed in ${Date.now() - execStart}ms`);
    
    // 清理node_modules目录，节省空间
    console.log(`[Task ${taskId}] Cleaning up resources...`);
    cleanupDirectory(taskDir);
    
    // 生成文件URL列表，排除node_modules
    const files = fs.readdirSync(taskDir).filter(file => {
      const filePath = path.join(taskDir, file);
      const isFile = fs.lstatSync(filePath).isFile();
      return isFile && file !== 'package.json' && file !== 'package-lock.json' && file !== 'index.js';
    });
    
    const fileUrls = files.map(file => {
      const fileURL = getFileUrl(datePath, taskId, file);
      console.log(`[Task ${taskId}] Generated file: ${fileURL}`);
      return {
        filename: file,
        url: fileURL
      };
    });
    
    // 计算总执行时间
    const totalTime = Date.now() - startTime;
    console.log(`[Task ${taskId}] Execution completed in ${totalTime}ms. Generated ${files.length} files.`);
    
    // 返回任务ID和文件URL
    res.json({
      taskId,
      files: fileUrls,
      executionTime: totalTime
    });
    
  } catch (error) {
    // 计算执行时间（即使出错）
    const totalTime = Date.now() - (startTime || Date.now());
    console.error(`[Task ${taskId || 'unknown'}] Error executing code: ${error.message}. Execution time: ${totalTime}ms`);
    
    // 清理资源
    if (taskDir && fs.existsSync(taskDir)) {
      try {
        cleanupDirectory(taskDir);
        console.log(`[Task ${taskId || 'unknown'}] Cleaned up task directory`);
      } catch (cleanupError) {
        console.error(`[Task ${taskId || 'unknown'}] Error cleaning up task directory: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      executionTime: totalTime
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Execute API: POST http://localhost:${port}/execute`);
  console.log(`Files will be available at: http://localhost:${port}/tasks/{taskId}/{filename}`);
});