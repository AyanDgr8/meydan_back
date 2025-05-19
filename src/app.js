// src/app.js

import express from "express";
import cors from "cors";
import router from './routes/router.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandling.js';
import morgan from "morgan"; 
import { logger } from './logger.js';

const app = express();

const allowedOrigins = ['https://localhost:3000', 'http://localhost:3000', 
                        'https://localhost:2000', 'http://localhost:2000',
                        'https://localhost:4000', 'http://localhost:4000',
                        'https://localhost:5000', 'http://localhost:5000',
                        'https://localhost:7777', 'http://localhost:7777',
                        'https://10.5.48.238:3000', 'http://10.5.48.238:3000',
                        'https://10.5.48.190:3000', 'http://10.5.48.190:3000',
                        'https://139.84.166.108:3000', 'http://139.84.166.108:3000', 
                        'https://192.168.95.146:3000', 'http://192.168.95.146:3000',
                        'https://192.168.1.8:4000','http://192.168.1.8:4000',
                        'https://10.5.48.238:4000', 'http://10.5.48.238:4000',
                        'http://10.5.51.246:4000','https://10.5.51.246:4000',
                        'https://crm.voicemeetme.net', 'http://crm.voicemeetme.net',
                        'https://crm.voicemeetme.net:3000','https://crm.voicemeetme.net:8443'
                      ]; // Add frontend URL

const corsOptions = {
  origin: function (origin, callback) {
    // console.log(`Incoming request origin: ${origin}`); // Debugging
    // Allow requests with no origin, like mobile apps or curl requests
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  // origin: true,
  credentials: true, // Allow credentials
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// // Use Morgan for logging HTTP requests
// app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use("/", router);

// Middleware for handling 404 errors
app.use(notFoundHandler);

// Middleware for handling errors
app.use(errorHandler);


// Global error handling
process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { app };