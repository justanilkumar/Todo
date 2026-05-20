const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'uploads', 'local_tasks.json');

/**
 * Get all tasks from the local JSON file
 * @returns {Array} - Array of task objects
 */
const getLocalTasks = () => {
  if (!fs.existsSync(dbFile)) {
    return [];
  }
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local database file:', err.message);
    return [];
  }
};

/**
 * Save tasks array to the local JSON file
 * @param {Array} tasks - Array of task objects to save
 */
const saveLocalTasks = (tasks) => {
  try {
    const uploadsDir = path.dirname(dbFile);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(dbFile, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to local database file:', err.message);
  }
};

module.exports = {
  getLocalTasks,
  saveLocalTasks
};
