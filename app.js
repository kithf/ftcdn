import fs from 'fs';
import path from 'path';
import compression from 'compression';
import express from 'express';
//import redis from 'redis';
import { JSONFilePreset } from 'lowdb/node';
import mime from 'mime';

const __dirname = import.meta.dirname;
console.log(`__dirname: ${__dirname}`);
const db = await JSONFilePreset('cache.json', {});

// Function must return a promise
const getAsync = async (key) => {
    const cachedData = db.data;
    return cachedData[key];
}


const setAsync = async (key, value) => {
    const cachedData = db.data
    cachedData[key] = value;
    await db.write(cachedData);
}

const app = express();
const PUBLIC_FOLDER = path.join(__dirname, 'public');
const BACKUP_CDN = 'https://test.test';

app.use(compression());

app.get('/', (req, res) => {
    res.send('Hello World');
});

// path site.com/files/path...
app.get('/files/*', async (req, res, next) => {
    const filePath = path.join(PUBLIC_FOLDER, req.params[0]);
    const cacheKey = `file:${req.path}`;

    console.log(`Requesting file: ${req.path} ${filePath}`);
    try {
        // Check if file is in cache
        const cachedFile = await getAsync(cacheKey);
        if (cachedFile) {
            console.log(`[HIT] Serving file from cache: ${req.path} ${ mime.getType(filePath)}`);
            //res.setHeader('Content-Type', mime.getType(filePath));
            res.setHeader('X-Cache', 'HIT');
            res.send(cachedFile);
        } else if (fs.existsSync(filePath)) {
            console.log(`[MISS] Serving file from public folder: ${req.path}`);
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            //res.setHeader('Content-Type', mime.getType(filePath));
            res.setHeader('X-Cache', 'MISS');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            // Cache file
            await setAsync(cacheKey, fileContent);
            res.send(fileContent);
        } else {
            console.log(`Redirecting to backup CDN: ${req.path}`);
            res.redirect(`${BACKUP_CDN}${req.path}`);
        }
    } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});