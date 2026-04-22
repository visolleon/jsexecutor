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

// 创建tasks目录用于存储任务文件
const tasksDir = path.join(__dirname, 'tasks');
if (!fs.existsSync(tasksDir)) {
  fs.mkdirSync(tasksDir, { recursive: true });
}

// 设置静态文件目录，用于提供生成的文件
app.use('/tasks', express.static(tasksDir));
app.use(express.json());

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

    // 生成任务UUID
    taskId = uuidv4();
    
    // 生成日期路径
    const datePath = getDatePath();
    taskDir = path.join(tasksDir, datePath, taskId);
    
    // 创建任务目录
    fs.mkdirSync(taskDir, { recursive: true });
    
    // 验证和过滤依赖
    const safeLibraries = [];
    if (libraries && Array.isArray(libraries)) {
      for (const lib of libraries) {
        if (typeof lib === 'string' && !DANGEROUS_PACKAGES.includes(lib)) {
          safeLibraries.push(lib);
        } else {
          console.warn(`Skipping dangerous package: ${lib}`);
        }
      }
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
    
    // 安装依赖
    console.log(`Installing dependencies for task ${taskId}...`);
    execSync('npm install', { 
      cwd: taskDir, 
      stdio: 'inherit',
      timeout: MAX_EXECUTION_TIME
    });
    
    // 创建执行文件
    const execFile = path.join(taskDir, 'index.js');
    fs.writeFileSync(execFile, code);
    
    // 执行代码
    console.log(`Executing code for task ${taskId}...`);
    execSync(`node --max-old-space-size=${MAX_MEMORY.replace('m', '')} index.js`, { 
      cwd: taskDir, 
      stdio: 'inherit',
      timeout: MAX_EXECUTION_TIME
    });
    
    // 清理node_modules目录，节省空间
    cleanupDirectory(taskDir);
    
    // 生成文件URL列表，排除node_modules
    const files = fs.readdirSync(taskDir).filter(file => {
      const filePath = path.join(taskDir, file);
      const isFile = fs.lstatSync(filePath).isFile();
      return isFile && file !== 'package.json' && file !== 'package-lock.json' && file !== 'index.js';
    });
    
    const fileUrls = files.map(file => {
      return {
        filename: file,
        url: getFileUrl(datePath, taskId, file)
      };
    });
    
    // 返回任务ID和文件URL
    res.json({
      taskId,
      files: fileUrls
    });
    
  } catch (error) {
    console.error('Error executing code:', error);
    
    // 清理资源
    if (taskDir && fs.existsSync(taskDir)) {
      try {
        cleanupDirectory(taskDir);
      } catch (cleanupError) {
        console.error(`Error cleaning up task directory: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Execute API: POST http://localhost:${port}/execute`);
  console.log(`Files will be available at: http://localhost:${port}/tasks/{taskId}/{filename}`);
});