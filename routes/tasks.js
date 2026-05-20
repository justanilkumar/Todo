const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { uploadToCloudOrLocal, deleteFromCloudOrLocal, isS3Configured } = require('../utils/upload');
const { getLocalTasks, saveLocalTasks } = require('../utils/localDb');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper check to verify database connection status
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks (with MongoDB to JSON fallback)
 */
router.get('/', async (req, res) => {
  try {
    let tasks;
    if (isDbConnected()) {
      tasks = await Task.find().sort({ createdAt: -1 });
    } else {
      console.log('MongoDB not connected. Serving tasks from local JSON database.');
      tasks = getLocalTasks().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    res.json({
      success: true,
      count: tasks.length,
      s3Active: isS3Configured(),
      dbFallback: !isDbConnected(),
      data: tasks
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task (with MongoDB to JSON fallback)
 */
router.post('/', upload.single('attachment'), async (req, res) => {
  try {
    const { title, description, priority, category, dueDate } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, error: 'Please add a title' });
    }

    let attachmentUrl = '';
    let attachmentKey = '';

    if (req.file) {
      const uploadResult = await uploadToCloudOrLocal(req.file);
      attachmentUrl = uploadResult.url;
      attachmentKey = uploadResult.key;
    }

    let task;
    if (isDbConnected()) {
      task = await Task.create({
        title,
        description,
        priority,
        category,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        attachmentUrl,
        attachmentKey
      });
    } else {
      const localTasks = getLocalTasks();
      task = {
        _id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description: description || '',
        completed: false,
        priority: priority || 'medium',
        category: category || 'Personal',
        dueDate: dueDate ? new Date(dueDate) : null,
        attachmentUrl,
        attachmentKey,
        createdAt: new Date()
      };
      localTasks.push(task);
      saveLocalTasks(localTasks);
      console.log('Saved new task to local JSON database fallback.');
    }

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task (with MongoDB to JSON fallback)
 */
router.put('/:id', upload.single('attachment'), async (req, res) => {
  try {
    const { title, description, completed, priority, category, dueDate, removeAttachment } = req.body;
    const taskId = req.params.id;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (completed !== undefined) updateData.completed = completed === 'true' || completed === true;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    let task;

    if (isDbConnected()) {
      task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      if (removeAttachment === 'true' || removeAttachment === true) {
        if (task.attachmentKey) {
          await deleteFromCloudOrLocal(task.attachmentKey);
        }
        updateData.attachmentUrl = '';
        updateData.attachmentKey = '';
      } else if (req.file) {
        if (task.attachmentKey) {
          await deleteFromCloudOrLocal(task.attachmentKey);
        }
        const uploadResult = await uploadToCloudOrLocal(req.file);
        updateData.attachmentUrl = uploadResult.url;
        updateData.attachmentKey = uploadResult.key;
      }

      task = await Task.findByIdAndUpdate(taskId, updateData, {
        new: true,
        runValidators: true
      });
    } else {
      const localTasks = getLocalTasks();
      const index = localTasks.findIndex(t => t._id === taskId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      task = localTasks[index];

      if (removeAttachment === 'true' || removeAttachment === true) {
        if (task.attachmentKey) {
          await deleteFromCloudOrLocal(task.attachmentKey);
        }
        updateData.attachmentUrl = '';
        updateData.attachmentKey = '';
      } else if (req.file) {
        if (task.attachmentKey) {
          await deleteFromCloudOrLocal(task.attachmentKey);
        }
        const uploadResult = await uploadToCloudOrLocal(req.file);
        updateData.attachmentUrl = uploadResult.url;
        updateData.attachmentKey = uploadResult.key;
      }

      const updatedTask = {
        ...task,
        ...updateData
      };

      localTasks[index] = updatedTask;
      saveLocalTasks(localTasks);
      task = updatedTask;
      console.log(`Updated task ${taskId} in local JSON database fallback.`);
    }

    res.json({ success: true, data: task });
  } catch (err) {
    console.error(`Error updating task ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task (with MongoDB to JSON fallback)
 */
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    let attachmentKey = '';

    if (isDbConnected()) {
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }
      attachmentKey = task.attachmentKey;
      await task.deleteOne();
    } else {
      const localTasks = getLocalTasks();
      const index = localTasks.findIndex(t => t._id === taskId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }
      attachmentKey = localTasks[index].attachmentKey;
      localTasks.splice(index, 1);
      saveLocalTasks(localTasks);
      console.log(`Deleted task ${taskId} from local JSON database fallback.`);
    }

    // Delete associated upload files
    if (attachmentKey) {
      await deleteFromCloudOrLocal(attachmentKey);
    }

    res.json({ success: true, data: {} });
  } catch (err) {
    console.error(`Error deleting task ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;
