import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar, 
  Paperclip, 
  Cloud, 
  Search, 
  AlertCircle, 
  Clock, 
  Folder, 
  Check, 
  Loader2, 
  Download, 
  Database,
  X,
  FileText,
  Image as ImageIcon
} from 'lucide-react';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // S3 connection check from backend
  const [s3Active, setS3Active] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('Personal');
  const [dueDate, setDueDate] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Editing State
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState('');
  const [removeAttachment, setRemoveAttachment] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Toast Notification State
  const [toast, setToast] = useState({ message: '', type: 'success', show: false });
  const toastTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch tasks on initial render
  useEffect(() => {
    fetchTasks();
  }, []);

  const showNotification = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, show: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
        setS3Active(data.s3Active);
      } else {
        setError(data.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend server. Make sure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showNotification('File exceeds 10MB limit', 'error');
        return;
      }
      setAttachment(file);
      setSelectedFileName(file.name);
      setRemoveAttachment(false);
    }
  };

  const clearForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('Personal');
    setDueDate('');
    setAttachment(null);
    setSelectedFileName('');
    setEditingTaskId(null);
    setExistingAttachmentUrl('');
    setRemoveAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotification('Title is required', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('priority', priority);
      formData.append('category', category);
      if (dueDate) formData.append('dueDate', dueDate);
      
      if (attachment) {
        formData.append('attachment', attachment);
      }

      let res;
      let url = '/api/tasks';
      
      if (editingTaskId) {
        url = `/api/tasks/${editingTaskId}`;
        formData.append('removeAttachment', removeAttachment);
        res = await fetch(url, {
          method: 'PUT',
          body: formData
        });
      } else {
        res = await fetch(url, {
          method: 'POST',
          body: formData
        });
      }

      const data = await res.json();

      if (data.success) {
        showNotification(
          editingTaskId ? 'Task updated successfully' : 'Task created successfully',
          'success'
        );
        clearForm();
        fetchTasks();
      } else {
        showNotification(data.error || 'Operation failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Server communication failure', 'error');
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      // Optimitic UI update
      setTasks(prevTasks => 
        prevTasks.map(t => t._id === task._id ? { ...t, completed: !t.completed } : t)
      );

      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ completed: !task.completed })
      });
      
      const data = await res.json();
      if (!data.success) {
        // Revert on error
        fetchTasks();
        showNotification(data.error || 'Failed to update status', 'error');
      } else {
        showNotification(
          data.data.completed ? 'Task completed! Good job 🎉' : 'Task marked as active',
          'info'
        );
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
      showNotification('Failed to update status', 'error');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      // Optimistic UI update
      setTasks(prevTasks => prevTasks.filter(t => t._id !== id));

      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Task deleted successfully', 'info');
      } else {
        fetchTasks();
        showNotification(data.error || 'Failed to delete task', 'error');
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
      showNotification('Failed to delete task', 'error');
    }
  };

  const handleEditClick = (task) => {
    setEditingTaskId(task._id);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(task.dueDate ? task.dueDate.substring(0, 10) : '');
    setExistingAttachmentUrl(task.attachmentUrl || '');
    setRemoveAttachment(false);
    setAttachment(null);
    setSelectedFileName('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dashboard Stats Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  
  const dueSoonTasks = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    const taskDate = new Date(t.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2; // Overdue tasks not counted here
  }).length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filters logic
  const filteredTasks = tasks.filter(task => {
    // Search query match
    const searchMatch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // Status filter match
    const statusMatch = 
      statusFilter === 'all' ||
      (statusFilter === 'completed' && task.completed) ||
      (statusFilter === 'pending' && !task.completed);

    // Priority filter match
    const priorityMatch = 
      priorityFilter === 'all' ||
      task.priority === priorityFilter;

    // Category filter match
    const categoryMatch = 
      categoryFilter === 'all' ||
      task.category === categoryFilter;

    return searchMatch && statusMatch && priorityMatch && categoryMatch;
  });

  const getAttachmentIcon = (url) => {
    if (!url) return null;
    const ext = url.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon size={14} />;
    }
    return <FileText size={14} />;
  };

  const getFileName = (url) => {
    if (!url) return '';
    const parts = url.split('/');
    const key = parts[parts.length - 1];
    // Remove timestamp prefix from name: e.g. "1716200000000_filename.pdf"
    return key.substring(key.indexOf('_') + 1);
  };

  const isOverdue = (task) => {
    if (!task.dueDate || task.completed) return false;
    const taskDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  return (
    <div className="app-wrapper">
      {/* Toast Banner notifications */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' && <Check size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Clock size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="fade-in">
        <div className="app-title-area">
          <h1>TaskFlow</h1>
          <p>Next-Gen Cloud Connected Task Management</p>
        </div>
        <div>
          {s3Active ? (
            <div className="cloud-badge">
              <Cloud size={16} />
              <span>AWS S3 Storage Active</span>
            </div>
          ) : (
            <div className="cloud-badge local">
              <Database size={16} />
              <span>Local Storage Fallback</span>
            </div>
          )}
        </div>
      </header>

      {/* Dashboard Statistics Widget */}
      <section className="stats-grid fade-in">
        <div className="glass-panel stat-card total">
          <div className="stat-icon-wrapper">
            <Folder size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
        </div>

        <div className="glass-panel stat-card completed">
          <div className="stat-icon-wrapper">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="stat-value">{completedTasks}</span>
              <span className="stat-label" style={{ fontSize: '0.75rem' }}>{completionRate}%</span>
            </div>
            <span className="stat-label">Completed</span>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${completionRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card high">
          <div className="stat-icon-wrapper">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{highPriorityTasks}</span>
            <span className="stat-label">High Priority</span>
          </div>
        </div>

        <div className="glass-panel stat-card due">
          <div className="stat-icon-wrapper">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{dueSoonTasks}</span>
            <span className="stat-label">Due Soon</span>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <main className="main-workspace">
        {/* Left Side: Create/Edit Form */}
        <section className="glass-panel form-panel fade-in">
          <h2>
            {editingTaskId ? <Edit2 size={20} className="edit-color" /> : <Plus size={20} />}
            <span>{editingTaskId ? 'Edit Task Details' : 'Create New Task'}</span>
          </h2>
          
          <form onSubmit={handleCreateOrUpdate}>
            <div className="form-group">
              <label htmlFor="title">Task Title *</label>
              <input
                id="title"
                type="text"
                className="text-input"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description (Optional)</label>
              <textarea
                id="description"
                className="textarea-input"
                placeholder="Enter details or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label>Priority Level</label>
              <div className="priority-selector">
                <button
                  type="button"
                  className={`priority-btn low ${priority === 'low' ? 'active' : ''}`}
                  onClick={() => setPriority('low')}
                >
                  Low
                </button>
                <button
                  type="button"
                  className={`priority-btn medium ${priority === 'medium' ? 'active' : ''}`}
                  onClick={() => setPriority('medium')}
                >
                  Medium
                </button>
                <button
                  type="button"
                  className={`priority-btn high ${priority === 'high' ? 'active' : ''}`}
                  onClick={() => setPriority('high')}
                >
                  High
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                className="select-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Personal">Personal</option>
                <option value="Work">Work</option>
                <option value="Study">Study</option>
                <option value="Health">Health</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                id="dueDate"
                type="date"
                className="text-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Attachment upload */}
            <div className="form-group">
              <label>Attachment File (Max 10MB)</label>
              
              {existingAttachmentUrl && !removeAttachment ? (
                <div className="selected-file-meta" style={{ border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {getAttachmentIcon(existingAttachmentUrl)}
                    <span style={{ color: 'var(--primary)' }}>{getFileName(existingAttachmentUrl)}</span>
                  </div>
                  <button 
                    type="button" 
                    className="remove-file-btn"
                    onClick={() => setRemoveAttachment(true)}
                    title="Remove old attachment"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : selectedFileName ? (
                <div className="selected-file-meta" style={{ border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Paperclip size={14} />
                    <span style={{ color: 'var(--success)' }}>{selectedFileName}</span>
                  </div>
                  <button 
                    type="button" 
                    className="remove-file-btn"
                    onClick={() => {
                      setAttachment(null);
                      setSelectedFileName('');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  className="file-upload-zone"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  <div className="file-upload-inner">
                    <Paperclip size={20} />
                    <span>Click to attach file</span>
                    <span>PDF, Images, Docs up to 10MB</span>
                  </div>
                </div>
              )}
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <button type="submit" className="submit-btn">
              {editingTaskId ? <Edit2 size={16} /> : <Plus size={16} />}
              <span>{editingTaskId ? 'Save Changes' : 'Add Task'}</span>
            </button>

            {editingTaskId && (
              <button 
                type="button" 
                className="cancel-edit-btn"
                onClick={clearForm}
              >
                Cancel Editing
              </button>
            )}
          </form>
        </section>

        {/* Right Side: Filters and Task List */}
        <section className="list-panel fade-in">
          {/* Toolbar panel */}
          <div className="glass-panel toolbar-card">
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="text-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="filterStatus">Status</label>
                <select
                  id="filterStatus"
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filterPriority">Priority</label>
                <select
                  id="filterPriority"
                  className="filter-select"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filterCategory">Category</label>
                <select
                  id="filterCategory"
                  className="filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Study">Study</option>
                  <option value="Health">Health</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Task List container */}
          <div className="task-items-container">
            {loading ? (
              <div className="empty-state">
                <Loader2 className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                <h3>Loading your workflow...</h3>
              </div>
            ) : error ? (
              <div className="empty-state">
                <AlertCircle style={{ color: 'var(--priority-high)' }} />
                <h3>Database Error</h3>
                <p>{error}</p>
                <button className="submit-btn" style={{ width: 'auto', marginTop: '1rem' }} onClick={fetchTasks}>
                  Try Again
                </button>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="glass-panel empty-state">
                <Folder />
                <h3>No Tasks Found</h3>
                <p>
                  {tasks.length === 0 
                    ? "Get started by building your first task on the left side form." 
                    : "No tasks match your selected filter criteria."}
                </p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div 
                  key={task._id} 
                  className={`glass-panel task-card ${task.priority} ${task.completed ? 'completed-task' : ''} fade-in`}
                >
                  {/* Status Checkbox */}
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => handleToggleComplete(task)}
                    />
                    <span className="custom-checkmark">
                      <Check />
                    </span>
                  </label>

                  {/* Task Meta details */}
                  <div className="task-content">
                    <div className="task-header">
                      <h3 className="task-title">{task.title}</h3>
                      <div className="task-badges-row">
                        <span className={`badge priority-${task.priority}`}>{task.priority}</span>
                        <span className="badge category">{task.category}</span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="task-description">{task.description}</p>
                    )}

                    <div className="task-footer-row">
                      {task.dueDate ? (
                        <div className={`task-meta-item ${isOverdue(task) ? 'overdue' : ''}`}>
                          <Calendar />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                            {isOverdue(task) && ' (Overdue)'}
                          </span>
                        </div>
                      ) : (
                        <div className="task-meta-item">
                          <Calendar />
                          <span>No due date</span>
                        </div>
                      )}

                      {task.attachmentUrl && (
                        <a 
                          href={task.attachmentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="attachment-chip"
                          title="Open attachment in new tab"
                        >
                          {getAttachmentIcon(task.attachmentUrl)}
                          <span>{getFileName(task.attachmentUrl)}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="task-actions">
                    <button 
                      className="action-btn edit" 
                      onClick={() => handleEditClick(task)}
                      title="Edit task details"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="action-btn delete" 
                      onClick={() => handleDeleteTask(task._id)}
                      title="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
