const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Express Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists for local fallback uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve local upload files statically
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow';
console.log(`Attempting to connect to MongoDB...`);
mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.log('Warning: App will run, but database actions will fail until MongoDB is connected.');
  });

// API Routes
app.use('/api/tasks', require('./routes/tasks'));

// Serve React Frontend Production Build Statically
const frontendBuildPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(frontendBuildPath, 'index.html'));
  });
  console.log('Production React UI frontend detected. Serving from build folder.');
} else {
  app.get('/', (req, res) => {
    res.send('TaskFlow API is running. (To view the interface, run the React development server in the /frontend directory)');
  });
}

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
