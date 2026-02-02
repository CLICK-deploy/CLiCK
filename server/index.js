import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRouter from "./routes/api.js";

dotenv.config();
const app = express();

// CORS configuration - restrict to specific origins for production
// For development, allow localhost. For production, replace with chrome-extension://YOUR_EXTENSION_ID
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    // Add your Chrome extension origin here: 'chrome-extension://YOUR_EXTENSION_ID'
];

app.use(cors({ 
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());
app.use("/api", apiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
